// Seed kursów OGÓLNYCH — 8 kategorii bez przypisanej trenerki, pod start kampanii Meta (13.09.2026).
//
// Czym się różnią od kursów Weroniki Kachel (`db:seed-weronika`): te NIE mają `trainerId`,
// `city` ani `voivodeship`. To opisy kategorii szkoleń dostępnych w całej Polsce — kursantka
// aplikuje o dofinansowanie, a konkretną akademię dobieramy dopiero w rozmowie telefonicznej.
//
// Treści pochodzą z vaulta: firmy/uniwersytet-beauty/content/kursy-ogolne-2026-09.md
// (tam też TABELA ŹRÓDEŁ dla wszystkich liczb o cenach rynkowych — w treści na stronie
// linków celowo NIE ma, żeby nie wypuszczać ruchu z płatnego landingu na agregatory).
//
// 🔴 CENA: kolumna `price_pln` jest NOT NULL w schemacie, więc musi mieć wartość — ale
// NIGDZIE w serwisie nie jest pokazywana (decyzja 13.09: zero kwot, komunikujemy wyłącznie
// procent dofinansowania). Wpisujemy 0 jako jawny znacznik „cena nieustalona, ustala akademia".
// Gdyby kiedykolwiek miała wrócić na stronę — NIE bierz jej stąd, bo to nie jest prawdziwa cena.
//
// Idempotentny: dopasowuje po slugu i pomija istniejące. Ręczne zmiany w panelu admina
// są ważniejsze od seeda i nie zostaną nadpisane.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type SeedCourse = {
  slug: string;
  title: string;
  category: string;
  level: string;
  mode: string;
  shortDescription: string;
  description: string;
  program: string[];
  includes: string[];
  forWhom: string;
  durationHours: number;
  totalSpots: number;
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
  const raw = readFileSync(join(process.cwd(), "scripts", "kursy-ogolne.json"), "utf-8");
  const KURSY: SeedCourse[] = JSON.parse(raw);

  const { db, close, schema } = await getDb();
  const { courses } = schema;

  let dodane = 0;
  let pominiete = 0;

  for (const k of KURSY) {
    const [istnieje] = await db
      .select({ id: courses.id, imageUrl: courses.imageUrl })
      .from(courses)
      .where(eq(courses.slug, k.slug))
      .limit(1);
    if (istnieje) {
      // Dosypka zdjęcia dla wierszy sprzed 13.09 wieczorem (seedowane bez imageUrl).
      // TYLKO gdy NULL — obrazek ustawiony ręcznie w panelu jest ważniejszy od seeda.
      if (!istnieje.imageUrl) {
        await db.update(courses).set({ imageUrl: `/kursy/${k.slug}.jpg` }).where(eq(courses.id, istnieje.id));
        console.log(`· ${k.title.slice(0, 60)} — już jest (#${istnieje.id}), dosypuję zdjęcie`);
      } else {
        console.log(`· ${k.title.slice(0, 60)} — już jest (#${istnieje.id}), pomijam`);
      }
      pominiete++;
      continue;
    }

    const [nowy] = await db
      .insert(courses)
      .values({
        slug: k.slug,
        title: k.title,
        category: k.category,
        level: k.level,
        mode: k.mode,
        shortDescription: k.shortDescription,
        description: k.description,
        program: k.program,
        includes: k.includes,
        forWhom: k.forWhom,
        price: 0, // patrz nota na górze pliku — nigdy nie pokazywane
        subsidyPercent: 95,
        totalSpots: k.totalSpots,
        takenSpots: 0,
        durationHours: k.durationHours,
        imageUrl: `/kursy/${k.slug}.jpg`,
        city: null,
        voivodeship: null,
        trainerId: null, // kurs ogólny — bez trenerki, taka jest cała idea
        status: "opublikowane",
      })
      .returning({ id: courses.id });

    console.log(`✓ ${k.title.slice(0, 60)} (#${nowy.id})`);
    dodane++;
  }

  const [{ ile }] = await db.select({ ile: schema.courses.id }).from(courses).then((r) => [{ ile: r.length }]);
  console.log(`\nKursów ogólnych dodano: ${dodane}, pominięto: ${pominiete}. Kursów w bazie łącznie: ${ile}.`);

  await close();
}

main().catch((e) => {
  console.error("Błąd seed-kursy-ogolne:", e);
  process.exit(1);
});
