/**
 * Dane testowe pod sprawdzenie panelu mailingu. Uruchamiać PRZED startem dev servera —
 * PGlite to plik otwierany przez jeden proces naraz.
 *
 * Sieje celowo trudne przypadki, a nie trzy ładne rekordy:
 *  - lead ze zgodą marketingową (ma dostać),
 *  - lead BEZ zgody (nie ma prawa dostać),
 *  - lead wypisany z mailingu (ma zostać pominięty),
 *  - porzucona aplikacja ze zgodą (ma dostać),
 *  - TEN SAM adres jako lead i jako porzucona aplikacja, zapisany RÓŻNĄ wielkością liter
 *    (ma dostać dokładnie jedną kopię — to jest test dedupu po znormalizowanym adresie).
 *
 * Użycie: npx tsx scripts/test-mailing-seed.ts
 */
import "dotenv/config";
import { randomBytes } from "crypto";
import { inArray } from "drizzle-orm";

async function getDb() {
  const url = process.env.DATABASE_URL;
  const schema = await import("../src/db/schema");
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    return { db: drizzle(new Pool({ connectionString: url }), { schema }), schema };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  return { db: drizzle(new PGlite(".pglite"), { schema }), schema };
}

const TAG = "mailtest";

async function main() {
  const { db, schema } = await getDb();
  const now = new Date();

  const emails = {
    zgoda: `${TAG}-zgoda@example.com`,
    bezZgody: `${TAG}-bez-zgody@example.com`,
    wypisana: `${TAG}-wypisana@example.com`,
    porzucona: `${TAG}-porzucona@example.com`,
    duplikat: `${TAG}-duplikat@example.com`,
  };

  // Czyszczenie po poprzednim przebiegu
  const all = Object.values(emails);
  const upper = all.map((e) => e.toUpperCase());
  await db.delete(schema.quizSessions).where(inArray(schema.quizSessions.email, [...all, ...upper]));
  await db.delete(schema.leads).where(inArray(schema.leads.email, [...all, ...upper]));
  await db
    .delete(schema.marketingSuppression)
    .where(inArray(schema.marketingSuppression.email, all));

  const lead = (email: string, opts: { marketing: boolean; category: string; woj: string }) => ({
    name: "Anna Testowa",
    phone: "600100200",
    email,
    voivodeship: opts.woj,
    category: opts.category,
    employmentStatus: "Zatrudniona na etacie",
    rodoConsentAt: now,
    contactConsentAt: now,
    marketingConsentAt: opts.marketing ? now : null,
  });

  await db.insert(schema.leads).values([
    lead(emails.zgoda, { marketing: true, category: "Stylizacja brwi", woj: "slaskie" }),
    lead(emails.bezZgody, { marketing: false, category: "Stylizacja brwi", woj: "slaskie" }),
    lead(emails.wypisana, { marketing: true, category: "Stylizacja brwi", woj: "slaskie" }),
    // Ten sam człowiek co porzucona sesja niżej, ale adres zapisany WIELKIMI literami.
    lead(emails.duplikat.toUpperCase(), { marketing: true, category: "Stylizacja rzęs", woj: "mazowieckie" }),
  ]);

  await db.insert(schema.quizSessions).values([
    {
      sessionKey: `${TAG}-${randomBytes(6).toString("hex")}`,
      name: "Basia Porzucona",
      email: emails.porzucona,
      category: "Stylizacja brwi",
      voivodeship: "slaskie",
      stepReached: 5,
      maxStepReached: 5,
      contactConsentAt: now,
      marketingConsentAt: now,
      completed: false,
    },
    {
      sessionKey: `${TAG}-${randomBytes(6).toString("hex")}`,
      name: "Anna Testowa",
      email: emails.duplikat,
      category: "Stylizacja rzęs",
      voivodeship: "mazowieckie",
      stepReached: 3,
      maxStepReached: 3,
      contactConsentAt: now,
      marketingConsentAt: now,
      completed: false,
    },
  ]);

  await db.insert(schema.marketingSuppression).values({
    email: emails.wypisana,
    token: randomBytes(32).toString("hex"),
    optOutAt: now,
    optOutSource: "test",
  });

  console.log("Zasiane:");
  console.log(`  ${emails.zgoda}       → lead ze zgodą (MA dostać)`);
  console.log(`  ${emails.bezZgody}    → lead bez zgody (NIE ma prawa dostać)`);
  console.log(`  ${emails.wypisana}    → lead ze zgodą, ale wypisany (ma być pominięty)`);
  console.log(`  ${emails.porzucona}   → porzucona aplikacja ze zgodą (MA dostać)`);
  console.log(`  ${emails.duplikat}    → lead (WIELKIMI) + porzucona sesja (ma dostać RAZ)`);
  console.log("\nOczekiwana liczba odbiorców bez filtrów: 3");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
