// Aktualizacja opisów WSZYSTKICH kursów (8 ogólnych + kursy trenerek) z content/kursy/opisy-kursow.json.
//
// Powstał 29.09.2026 po uwadze Bartka: opisy były ścianą tekstu z treściami „wyssanymi z palca"
// (liczba dni, godzin, modelek, co wchodzi w cenę) — a od trenerek nie mamy jeszcze programów.
// Nowe opisy są ogólne, edukacyjne, bez szczegółów, których nie znamy.
//
// Dotyka pól: description, shortDescription, forWhom, a program/includes TYLKO gdy wpis je
// zawiera (kursy ogólne: puste listy, żeby zniknęły zmyślone sekcje; kursy WK: program z jej
// strony zostaje nietknięty). Nie rusza ceny, dofinansowania, statusu ani trenerki.
//
// Tryb z entrypointu: `--tylko-z-flaga` zapisuje wyłącznie wtedy, gdy istnieje plik
// content/kursy/opisy-kursow.nadpisz. Flagę zdejmujemy w następnym commicie po wdrożeniu,
// inaczej każdy restart kontenera kasowałby poprawki z panelu admina (ten sam wzorzec co
// `nadpisz_w_bazie` w blogu).
//
// Użycie:
//   npm run db:opisy-kursow -- --dry   # pokaż co by się zmieniło
//   npm run db:opisy-kursow            # zapisz
import "dotenv/config";
import { eq } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Opis = {
  slug: string;
  shortDescription: string;
  description: string;
  forWhom: string;
  program?: string[];
  includes?: string[];
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
  if (process.argv.includes("--tylko-z-flaga") && !existsSync(join(process.cwd(), "content/kursy/opisy-kursow.nadpisz"))) {
    console.log("· opisy kursów: brak flagi opisy-kursow.nadpisz — pomijam.");
    return;
  }
  const opisy: Opis[] = JSON.parse(readFileSync(join(process.cwd(), "content/kursy/opisy-kursow.json"), "utf8"));

  // Guardrails treści: zero „0 zł"/„za darmo", jedyny procent to „nawet do 95%" (decyzja 29.09),
  // zero widełek procentowych.
  const zakazane = /\b0 zł|za darmo|bezpłatn|\d+ ?%? ?[-–—] ?\d+ ?%/i;
  for (const o of opisy) {
    const tekst = `${o.description} ${o.shortDescription} ${o.forWhom} ${(o.program ?? []).join(" ")} ${(o.includes ?? []).join(" ")}`;
    if (zakazane.test(tekst)) throw new Error(`Guardrail: "${o.slug}" zawiera zakazaną frazę (${tekst.match(zakazane)?.[0]}).`);
    const procenty = tekst.match(/\d+ ?%/g) ?? [];
    if (procenty.some((p) => p.replace(" ", "") !== "95%")) throw new Error(`Guardrail: "${o.slug}" ma procent inny niż 95%: ${procenty.join(", ")}`);
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
        program: courses.program,
        includes: courses.includes,
      })
      .from(courses)
      .where(eq(courses.slug, o.slug))
      .limit(1);
    if (!kurs) {
      brakujace.push(o.slug);
      continue;
    }
    const zmiana: Record<string, unknown> = {};
    if (kurs.description !== o.description) zmiana.description = o.description;
    if (kurs.shortDescription !== o.shortDescription) zmiana.shortDescription = o.shortDescription;
    if (kurs.forWhom !== o.forWhom) zmiana.forWhom = o.forWhom;
    if (o.program && JSON.stringify(kurs.program) !== JSON.stringify(o.program)) zmiana.program = o.program;
    if (o.includes && JSON.stringify(kurs.includes) !== JSON.stringify(o.includes)) zmiana.includes = o.includes;
    if (Object.keys(zmiana).length === 0) {
      bezZmian++;
      continue;
    }
    if (!dry) await db.update(courses).set(zmiana).where(eq(courses.id, kurs.id));
    zmienione++;
    console.log(`${dry ? "· [dry]" : "✓"} ${o.slug} (${Object.keys(zmiana).join(", ")})`);
  }

  console.log(`\n${dry ? "[dry] Do aktualizacji" : "Zaktualizowano"}: ${zmienione} · bez zmian: ${bezZmian} · nie ma w bazie: ${brakujace.length}`);
  if (brakujace.length > 0) console.log(`⚠ Slugi nieobecne w bazie: ${brakujace.join(", ")}`);
  await close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Błąd opisy-kursow:", err);
    process.exit(1);
  });
