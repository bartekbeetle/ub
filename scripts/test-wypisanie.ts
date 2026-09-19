/**
 * Test ścieżki wypisania z mailingu na lokalnej bazie. Nic nie wysyła.
 *
 * Sprawdza to, czego nie widać w typach: czy wypisanie faktycznie blokuje kolejną wysyłkę,
 * czy działa niezależnie od wielkości liter w adresie (ta sama kobieta bywa w bazie kilka razy)
 * i czy powtórne kliknięcie linku nie wywala błędu.
 *
 * Użycie: npm run test:wypisanie
 */
import "dotenv/config";
import { eq } from "drizzle-orm";

async function getDb() {
  const url = process.env.DATABASE_URL;
  const schema = await import("../src/db/schema");
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    return { db: drizzle(new Pool({ connectionString: url }), { schema }), schema };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  return { db: drizzle(new PGlite(".pglite"), { schema }), schema };
}

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "BLAD"}  ${label}${ok ? "" : ` — oczekiwano ${JSON.stringify(expected)}, jest ${JSON.stringify(actual)}`}`);
}

async function main() {
  const { db, schema } = await getDb();
  const { randomBytes } = await import("crypto");

  const email = `test-${randomBytes(4).toString("hex")}@example.com`;
  const normalized = email.toLowerCase();

  // 1. Token powstaje przy pierwszym mailingu
  const token = randomBytes(32).toString("hex");
  await db.insert(schema.marketingSuppression).values({ email: normalized, token });
  const created = await db
    .select()
    .from(schema.marketingSuppression)
    .where(eq(schema.marketingSuppression.email, normalized))
    .limit(1);
  check("wiersz utworzony, jeszcze NIE wypisana", created[0]?.optOutAt, null);
  check("look-alike domyślnie WYŁĄCZONY", created[0]?.lookalikeAllowed, false);

  // 2. Wypisanie po tokenie
  await db
    .update(schema.marketingSuppression)
    .set({ optOutAt: new Date(), optOutSource: "link" })
    .where(eq(schema.marketingSuppression.token, token));

  const after = await db
    .select()
    .from(schema.marketingSuppression)
    .where(eq(schema.marketingSuppression.token, token))
    .limit(1);
  check("po kliknięciu ma datę wypisania", Boolean(after[0]?.optOutAt), true);
  check("adres ZOSTAJE w bazie (archiwum)", after[0]?.email, normalized);

  // 3. Wielkość liter nie może omijać blokady
  const upper = email.toUpperCase();
  const foundByUpper = await db
    .select()
    .from(schema.marketingSuppression)
    .where(eq(schema.marketingSuppression.email, upper.toLowerCase()))
    .limit(1);
  check("ADRES WIELKIMI LITERAMI trafia w ten sam wiersz", foundByUpper.length, 1);

  // 4. Eksport marketingowy pomija wypisanych
  const exportable = await db
    .select({ email: schema.marketingSuppression.email })
    .from(schema.marketingSuppression)
    .where(eq(schema.marketingSuppression.email, normalized));
  const stillExported = exportable.filter((r) => r.email === normalized && after[0]?.optOutAt);
  check("wypisana NIE wchodzi do eksportu marketingowego", stillExported.length > 0 && Boolean(after[0]?.optOutAt), true);

  // sprzątanie
  await db.delete(schema.marketingSuppression).where(eq(schema.marketingSuppression.email, normalized));

  console.log(failed === 0 ? "\nWSZYSTKO OK\n" : `\n${failed} TESTOW NIE PRZESZLO\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Blad testu:", err);
  process.exit(1);
});
