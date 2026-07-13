// Migracje działają identycznie na PGlite (dev) i Postgres (Railway prod).
import "dotenv/config";

async function main() {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await pool.end();
    console.log("✓ Migracje wykonane (Postgres)");
  } else {
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite("./.pglite");
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await client.close();
    console.log("✓ Migracje wykonane (PGlite dev)");
  }
}

main()
  // Wymuszony exit: pg Pool na Railway (SSL keepalive) potrafi zostawić wiszący
  // uchwyt po pool.end(), przez co proces migracji nie kończy się i `&& npm start`
  // nigdy nie rusza -> 502. process.exit(0) gwarantuje przejście do next start.
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Błąd migracji:", err);
    process.exit(1);
  });
