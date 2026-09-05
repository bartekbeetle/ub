// Aktualizacja opisów szkoleń Weroniki Kachel z content/kursy/wk-opisy.json.
//
// DLACZEGO OSOBNY SKRYPT, a nie zmiana w seed-weronika.ts:
// seed-weronika jest insert-only z early returnem — gdy profil "weronika-kachel" już
// istnieje (a na produkcji istnieje od 25.07), skrypt kończy się bez żadnego zapisu.
// Wpisanie opisów do niego nie zmieniłoby więc na stronie ani jednego znaku.
//
// DLACZEGO NIE W ENTRYPOINCIE: kursy są edytowalne w panelu admina. Nadpisywanie ich
// przy każdym starcie kontenera kasowałoby ręczne poprawki — ten sam powód, dla którego
// pełny seed bloga został świadomie ręczny (patrz docker-entrypoint.sh).
//
// Dotyka WYŁĄCZNIE trzech pól opisowych: description, shortDescription, forWhom.
// Nie rusza ceny, dofinansowania, programu, includes, statusu ani przypisania do trenerki.
// Idempotentny — drugie odpalenie nic nie zmienia.
//
// Użycie:
//   npm run db:opisy-wk -- --dry   # pokaż co by się zmieniło, nic nie zapisuj
//   npm run db:opisy-wk            # zapisz
import "dotenv/config";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Opis = {
  slug: string;
  shortDescription: string;
  description: string;
  forWhom: string;
};

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
  const dry = process.argv.includes("--dry");
  const plik = join(process.cwd(), "content/kursy/wk-opisy.json");
  const opisy: Opis[] = JSON.parse(readFileSync(plik, "utf8"));

  // Guardrail ceny UB: nigdzie nie wolno obiecać szkolenia za 0 zł ani "za darmo",
  // a każda kwota po dofinansowaniu musi mieć warunek (województwo / nabór).
  const zakazane = /\b0 zł|za darmo|bezpłatn/i;
  for (const o of opisy) {
    const tekst = `${o.description} ${o.shortDescription} ${o.forWhom}`;
    if (zakazane.test(tekst)) {
      throw new Error(`Guardrail ceny: "${o.slug}" obiecuje szkolenie za darmo. Popraw treść przed zapisem.`);
    }
  }

  const { db, close, schema } = await getDb();
  const { courses } = schema;

  let zmienione = 0;
  let bezZmian = 0;
  const brakujace: string[] = [];

  for (const o of opisy) {
    const [kurs] = await db
      .select({
        id: courses.id,
        description: courses.description,
        shortDescription: courses.shortDescription,
        forWhom: courses.forWhom,
      })
      .from(courses)
      .where(eq(courses.slug, o.slug))
      .limit(1);

    if (!kurs) {
      brakujace.push(o.slug);
      continue;
    }

    const bezRoznic =
      kurs.description === o.description &&
      kurs.shortDescription === o.shortDescription &&
      kurs.forWhom === o.forWhom;

    if (bezRoznic) {
      bezZmian++;
      continue;
    }

    if (!dry) {
      await db
        .update(courses)
        .set({
          description: o.description,
          shortDescription: o.shortDescription,
          forWhom: o.forWhom,
        })
        .where(eq(courses.id, kurs.id));
    }
    zmienione++;
    console.log(`${dry ? "· [dry]" : "✓"} ${o.slug}`);
  }

  console.log(
    `\n${dry ? "[dry] Do aktualizacji" : "Zaktualizowano"}: ${zmienione} · bez zmian: ${bezZmian} · nie ma w bazie: ${brakujace.length}`
  );
  if (brakujace.length > 0) {
    console.log(`⚠ Slugi nieobecne w bazie (odpal najpierw db:seed-weronika): ${brakujace.join(", ")}`);
  }

  await close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Błąd opisy-wk:", err);
    process.exit(1);
  });
