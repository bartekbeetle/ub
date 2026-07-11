import "dotenv/config";
import { seedTrainerUsers, TRAINER_PASSWORD } from "./seed-trainer-users-lib";

async function getDb() {
  const url = process.env.DATABASE_URL;
  const schema = await import("../src/db/schema");
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    return { db: drizzle(pool, { schema }), close: () => pool.end(), schema };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite("./.pglite");
  return { db: drizzle(client, { schema }), close: () => client.close(), schema };
}

async function main() {
  const { db, close, schema } = await getDb();
  const results = await seedTrainerUsers(db as never, schema);
  await close();

  console.log("\n=== Konta trenerek (panel /panel/login) ===");
  console.log(`Hasło startowe: ${TRAINER_PASSWORD} (wymuszona zmiana przy 1. logowaniu)\n`);
  for (const r of results) {
    console.log(`${r.created ? "✓ utworzono" : "• istnieje "}  ${r.trainerName.padEnd(24)} ${r.email}`);
  }
  const created = results.filter((r) => r.created).length;
  console.log(`\nUtworzono ${created} nowych kont, pominięto ${results.length - created} istniejących.`);
}

main().catch((err) => {
  console.error("Błąd seeda kont trenerek:", err);
  process.exit(1);
});
