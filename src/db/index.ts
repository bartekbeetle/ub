import * as schema from "./schema";

// Fabryka bazy: produkcja = Postgres (DATABASE_URL z env; Supabase — appka przez
// pooler :6543/transaction mode, migracje/seedy przez direct :5432),
// dev bez Postgresa = wbudowany PGlite (plik ./.pglite).
// Singleton przez globalThis — Next.js w dev przeładowuje moduły.

type DB = ReturnType<typeof createDb> extends Promise<infer T> ? T : never;

declare global {
  // eslint-disable-next-line no-var
  var __ubDb: Promise<DB> | undefined;
}

async function createDb() {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    // Na Vercelu każda instancja funkcji ma własny pool — mały max, żeby nie
    // zjadać połączeń poolera Supabase; poza serverless (lokalnie) 10.
    const pool = new Pool({
      connectionString: url,
      max: process.env.VERCEL ? 2 : 10,
    });
    return drizzle(pool, { schema });
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite("./.pglite");
  return drizzle(client, { schema });
}

export function getDb(): Promise<DB> {
  if (!globalThis.__ubDb) {
    globalThis.__ubDb = createDb() as Promise<DB>;
  }
  return globalThis.__ubDb;
}

export { schema };
