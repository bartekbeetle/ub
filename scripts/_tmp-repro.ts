// TYMCZASOWY skrypt diagnostyczny — do skasowania po naprawie.
// Sprawdza, ile rekordów ma wartości spoza słownika CATEGORIES / slugów województw.
import "dotenv/config";
import { CATEGORIES, VOIVODESHIPS } from "../src/lib/constants";

const CATS = new Set<string>(CATEGORIES as unknown as string[]);
const SLUGS = new Set(VOIVODESHIPS.map((v) => v.slug));

async function main() {
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const schema = await import("../src/db/schema");
  const client = new PGlite("./.pglite");
  const db = drizzle(client, { schema });

  const trainers = await db.select().from(schema.trainers);
  console.log(`\n=== TRENERKI (${trainers.length}) ===`);
  for (const t of trainers) {
    const badSpecs = (t.specializations ?? []).filter((s) => !CATS.has(s));
    const badVoiv = t.voivodeship && !SLUGS.has(t.voivodeship) ? t.voivodeship : null;
    if (badSpecs.length || badVoiv) {
      console.log(`✗ ${t.name} (id=${t.id})`);
      if (badSpecs.length) console.log(`    specjalizacje spoza słownika: ${badSpecs.join(" | ")}`);
      if (badVoiv) console.log(`    województwo nie jest slugiem: "${badVoiv}"`);
    } else {
      console.log(`✓ ${t.name}`);
    }
  }

  const courses = await db.select().from(schema.courses);
  const badCourses = courses.filter((c) => !CATS.has(c.category) || (c.voivodeship && !SLUGS.has(c.voivodeship)));
  console.log(`\n=== KURSY (${courses.length}, wadliwych: ${badCourses.length}) ===`);
  const byCat = new Map<string, number>();
  for (const c of badCourses) {
    const key = `kategoria="${c.category}" / województwo="${c.voivodeship ?? ""}"`;
    byCat.set(key, (byCat.get(key) ?? 0) + 1);
  }
  for (const [k, n] of byCat) console.log(`   ${n}× ${k}`);

  const leads = await db.select().from(schema.leads);
  console.log(`\n=== LEADY (${leads.length}) === (dla porównania — jakie wartości zapisuje formularz)`);
  for (const l of leads.slice(0, 3)) console.log(`   kategoria="${l.category}" województwo="${l.voivodeship}"`);

  await client.close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
