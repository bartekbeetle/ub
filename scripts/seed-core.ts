// Seed PRODUKCYJNY: wyłącznie konto admina + wiersz ustawień. Zero danych demo.
// Idempotentny — bezpieczny w startCommand (migrate && seed-core && start).
// Dane demo (trenerki, kursy, opinie) żyją w scripts/seed.ts i są TYLKO do dev.
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
  const { db, close, schema } = await getDb();
  const { users, settings } = schema;

  // Ustawienia: wiersz id=1 (getSettings i tak się self-healuje, ale seedujemy jawnie)
  const settingsRow = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (settingsRow.length === 0) {
    await db.insert(settings).values({ id: 1 });
    console.log("✓ Ustawienia (id=1) utworzone");
  }

  // Admin: tylko jeśli nie istnieje żaden użytkownik z rolą admin
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (admins.length > 0) {
    console.log("Seed-core: admin już istnieje — nic do zrobienia.");
    await close();
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("Brak ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD w env — nie mogę utworzyć konta admina.");
  }
  await db.insert(users).values({
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: "admin",
    mustChangePassword: true,
  });
  console.log(`✓ Admin: ${adminEmail} (wymuszona zmiana hasła przy 1. logowaniu)`);
  await close();
}

main()
  // Wymuszony exit jak w migrate.ts: pg Pool potrafi zostawić wiszący uchwyt
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Błąd seed-core:", err);
    process.exit(1);
  });
