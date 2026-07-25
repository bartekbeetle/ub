// Reset hasła admina — ratunek, gdy hasło z ADMIN_INITIAL_PASSWORD nie pasuje do bazy.
// Uwaga: seed-core zakłada konto TYLKO gdy nie ma żadnego admina, więc późniejsza zmiana
// zmiennej środowiskowej NIE zmienia hasła w bazie. Ten skrypt zmienia je naprawdę.
//
// Użycie (terminal kontenera w Coolify albo lokalnie z DATABASE_URL produkcyjnym):
//   NEW_ADMIN_PASSWORD='mocne-haslo' npm run admin:reset-password
//   NEW_ADMIN_PASSWORD='mocne-haslo' ADMIN_EMAIL='inny@adres.pl' npm run admin:reset-password
//
// Po zalogowaniu aplikacja i tak wymusi ustawienie własnego hasła (mustChangePassword).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function getDb() {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const schema = await import("../src/db/schema");
    const pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 15000,
      statement_timeout: 30000,
    });
    return { db: drizzle(pool, { schema }), close: () => pool.end(), schema };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const schema = await import("../src/db/schema");
  const client = new PGlite("./.pglite");
  return { db: drizzle(client, { schema }), close: () => client.close(), schema };
}

async function main() {
  const newPassword = process.env.NEW_ADMIN_PASSWORD;
  if (!newPassword || newPassword.length < 10) {
    throw new Error("Ustaw NEW_ADMIN_PASSWORD (min. 10 znaków).");
  }

  const { db, close, schema } = await getDb();
  const { users } = schema;

  // Domyślnie bierzemy pierwszego admina w bazie — ADMIN_EMAIL tylko gdy chcesz wskazać konkretne konto.
  const wantedEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const admins = await db.select().from(users).where(eq(users.role, "admin"));
  if (admins.length === 0) {
    throw new Error("W bazie nie ma żadnego admina — odpal najpierw `npm run db:seed-core`.");
  }
  const target = wantedEmail ? admins.find((u) => u.email.toLowerCase() === wantedEmail) : admins[0];
  if (!target) {
    throw new Error(
      `Brak admina o adresie ${wantedEmail}. Konta w bazie: ${admins.map((u) => u.email).join(", ")}`,
    );
  }

  await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(newPassword, 12),
      // Konto mogło zostać wcześniej dezaktywowane — reset przywraca dostęp.
      isActive: true,
      // Wymuszamy własne hasło zaraz po zalogowaniu, żeby to z komendy nie zostało na stałe.
      mustChangePassword: true,
    })
    .where(eq(users.id, target.id));

  console.log(`✓ Hasło zresetowane dla: ${target.email} (przy pierwszym logowaniu system poprosi o zmianę)`);
  await close();
}

main()
  // Wymuszony exit jak w migrate.ts: pg Pool potrafi zostawić wiszący uchwyt
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Błąd resetu hasła:", err.message ?? err);
    process.exit(1);
  });
