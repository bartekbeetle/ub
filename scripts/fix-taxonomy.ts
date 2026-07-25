// Naprawa taksonomii: sprowadza specjalizacje trenerek, kategorie kursów i województwa
// do słownika z src/lib/constants.ts (CATEGORIES + slugi VOIVODESHIPS).
//
// Dlaczego to jest ważniejsze niż formularz w panelu:
// src/lib/matching.ts dobiera trenerkę do leada przez DOKŁADNE porównanie
//   trainers.voivodeship == leads.voivodeship  (slug!)
//   trainers.specializations @> [leads.category]  (wartość z CATEGORIES)
// Rekord z wartościami spoza słownika nie dopasuje się NIGDY — cicho, bez błędu.
//
// Idempotentny: po naprawie kolejne uruchomienie nic nie zmienia.
// Użycie:  npm run db:fix-taxonomy        (dodaj DATABASE_URL, żeby ruszyć produkcję)
import "dotenv/config";
import { CATEGORIES, VOIVODESHIPS } from "../src/lib/constants";

const CANON = new Set<string>(CATEGORIES as unknown as string[]);

// Zastane wartości opisowe → kategoria ze słownika.
// Cała oferta Weroniki (brwi, usta, kreski, microblading, usuwanie, pigmentacja medyczna)
// to techniki makijażu permanentnego, więc mapują się na jedną kategorię matchingową.
const LEGACY_TO_CANON: Record<string, string> = {
  "Makijaż permanentny": "PMU / Makijaż permanentny",
  "Makijaż permanentny brwi": "PMU / Makijaż permanentny",
  "Makijaż permanentny ust": "PMU / Makijaż permanentny",
  "Microblading": "PMU / Makijaż permanentny",
  "Kreski / eyeliner": "PMU / Makijaż permanentny",
  "Usuwanie PMU (laserowe i bezlaserowe)": "PMU / Makijaż permanentny",
  "Pigmentacja medyczna": "PMU / Makijaż permanentny",
  "Rzęsy": "Stylizacja rzęs",
  "Brwi": "Stylizacja brwi",
  "Paznokcie": "Stylizacja paznokci",
};

/** "śląskie" / "Śląskie" → "slaskie". Zwraca null, gdy nie da się dopasować. */
function toVoivodeshipSlug(value: string): string | null {
  if (VOIVODESHIPS.some((v) => v.slug === value)) return value;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z-]/g, "");
  const hit = VOIVODESHIPS.find((v) => norm(v.name) === norm(value) || v.slug === norm(value));
  return hit?.slug ?? null;
}

/** Kategorie: przepuszcza kanoniczne, mapuje znane zastane, resztę zgłasza jako nierozpoznaną. */
function toCanonCategory(value: string): { value: string | null; unknown?: string } {
  if (CANON.has(value)) return { value };
  const mapped = LEGACY_TO_CANON[value];
  if (mapped) return { value: mapped };
  return { value: null, unknown: value };
}

async function getDb() {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const schema = await import("../src/db/schema");
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
    return { db: drizzle(pool, { schema }), close: () => pool.end(), schema, target: "Postgres (DATABASE_URL)" };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const schema = await import("../src/db/schema");
  const client = new PGlite("./.pglite");
  return { db: drizzle(client, { schema }), close: () => client.close(), schema, target: "PGlite (lokalna)" };
}

async function main() {
  const { db, close, schema, target } = await getDb();
  const { eq } = await import("drizzle-orm");
  console.log(`Baza: ${target}\n`);

  const unresolved: string[] = [];
  let changed = 0;

  // --- TRENERKI ---
  for (const t of await db.select().from(schema.trainers)) {
    const patch: Record<string, unknown> = {};

    const specsIn = t.specializations ?? [];
    const specsOut: string[] = [];
    for (const s of specsIn) {
      const { value, unknown } = toCanonCategory(s);
      if (unknown) unresolved.push(`trenerka "${t.name}" → specjalizacja "${unknown}"`);
      else if (value && !specsOut.includes(value)) specsOut.push(value);
    }
    if (specsOut.length && JSON.stringify(specsIn) !== JSON.stringify(specsOut)) {
      patch.specializations = specsOut;
    }

    if (t.voivodeship) {
      const slug = toVoivodeshipSlug(t.voivodeship);
      if (!slug) unresolved.push(`trenerka "${t.name}" → województwo "${t.voivodeship}"`);
      else if (slug !== t.voivodeship) patch.voivodeship = slug;
    }

    if (Object.keys(patch).length) {
      await db.update(schema.trainers).set(patch).where(eq(schema.trainers.id, t.id));
      changed++;
      console.log(`✓ ${t.name}`);
      if (patch.specializations) console.log(`    specjalizacje: [${specsIn.join(", ")}] → [${(patch.specializations as string[]).join(", ")}]`);
      if (patch.voivodeship) console.log(`    województwo: "${t.voivodeship}" → "${patch.voivodeship}"`);
    }
  }

  // --- KURSY ---
  let coursesChanged = 0;
  for (const c of await db.select().from(schema.courses)) {
    const patch: Record<string, unknown> = {};

    const { value, unknown } = toCanonCategory(c.category);
    if (unknown) unresolved.push(`kurs "${c.title}" → kategoria "${unknown}"`);
    else if (value && value !== c.category) patch.category = value;

    if (c.voivodeship) {
      const slug = toVoivodeshipSlug(c.voivodeship);
      if (!slug) unresolved.push(`kurs "${c.title}" → województwo "${c.voivodeship}"`);
      else if (slug !== c.voivodeship) patch.voivodeship = slug;
    }

    if (Object.keys(patch).length) {
      await db.update(schema.courses).set(patch).where(eq(schema.courses.id, c.id));
      coursesChanged++;
    }
  }
  if (coursesChanged) console.log(`✓ Kursy poprawione: ${coursesChanged}`);

  if (!changed && !coursesChanged) console.log("Nic do poprawienia — taksonomia już zgodna ze słownikiem.");

  if (unresolved.length) {
    console.log("\n⚠ Wartości, których NIE umiem zmapować (zostały nietknięte, dopisz je do LEGACY_TO_CANON):");
    for (const u of [...new Set(unresolved)]) console.log(`   • ${u}`);
  }

  await close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("Błąd naprawy taksonomii:", e);
  process.exit(1);
});
