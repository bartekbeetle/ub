// Awans konta admina na SUPERADMINA (właściciel: rozliczenia, ustawienia, zespół, dziennik zmian).
// Idempotentny — drugie uruchomienie na tym samym koncie nic nie zmienia.
//
// Użycie (terminal kontenera w Coolify albo lokalnie z DATABASE_URL produkcyjnym):
//   npm run admin:superadmin -- twoj@adres.pl
//   SUPERADMIN_EMAIL=twoj@adres.pl npm run admin:superadmin
//
// Bez adresu skrypt NIC nie zmienia: wypisuje istniejące konta administracji i gotową komendę
// (przy dokładnie jednym adminie i zero superadminach podstawia jego adres).
//
// Dlaczego skrypt, a nie migracja: migracja dodaje tylko wartość enuma `superadmin`
// (Postgres nie pozwala użyć świeżo dodanej wartości w tej samej transakcji), a adres
// właściciela nie powinien być zaszyty w repo.
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";

async function getDb() {
  const url = process.env.DATABASE_URL;
  const schema = await import("../src/db/schema");
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
    return { db: drizzle(pool, { schema }), close: () => pool.end(), schema };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite("./.pglite");
  return { db: drizzle(client, { schema }), close: () => client.close(), schema };
}

async function main() {
  const email = (process.argv[2] ?? process.env.SUPERADMIN_EMAIL ?? "").trim().toLowerCase();
  const { db, close, schema } = await getDb();
  const { users, adminAuditLog } = schema;

  const team = await db
    .select()
    .from(users)
    .where(inArray(users.role, ["admin", "superadmin"]));
  const admins = team.filter((u) => u.role === "admin");
  const supers = team.filter((u) => u.role === "superadmin");

  if (!email) {
    console.log("Nie podano adresu. Konta administracji w bazie:");
    for (const u of team) console.log(`  - ${u.email}  [${u.role}]${u.isActive ? "" : " (wyłączone)"}`);
    if (supers.length === 0 && admins.length === 1) {
      console.log(`\nJest dokładnie jeden admin i zero superadminów. Awansuj go:\n  npm run admin:superadmin -- ${admins[0].email}`);
    } else if (team.length === 0) {
      console.log("\nBrak kont administracji — odpal najpierw `npm run db:seed-core`.");
    } else {
      console.log("\nWskaż konto:\n  npm run admin:superadmin -- adres@konta.pl");
    }
    await close();
    process.exitCode = 1;
    return;
  }

  const [target] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!target) throw new Error(`Brak konta ${email}. Konta administracji: ${team.map((u) => u.email).join(", ") || "(brak)"}`);
  if (target.role === "superadmin") {
    console.log(`✓ ${target.email} jest już superadminem — nic do zrobienia.`);
    await close();
    return;
  }
  if (target.role !== "admin") {
    throw new Error(`Konto ${target.email} ma rolę „${target.role}”. Awansować można tylko konto admina.`);
  }

  await db.update(users).set({ role: "superadmin", isActive: true }).where(eq(users.id, target.id));
  await db.insert(adminAuditLog).values({
    actorUserId: null,
    actorRole: "system",
    action: "zespol_superadmin_awansowany",
    entityType: "user",
    entityId: target.id,
    details: { email: target.email, via: "scripts/promote-superadmin.ts" },
  });
  console.log(`✓ ${target.email}: admin → superadmin. Zaloguj się ponownie, żeby zobaczyć Zespół, Rozliczenia i Ustawienia.`);
  await close();
}

main()
  // Wymuszony exit jak w migrate.ts: pg Pool potrafi zostawić wiszący uchwyt
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("Błąd awansu:", err.message ?? err);
    process.exit(1);
  });
