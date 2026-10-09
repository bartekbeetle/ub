/**
 * Test JEDNEGO ŹRÓDŁA LICZB O LEADACH (`src/lib/lead-metrics-core.ts`) na PGlite w pamięci.
 * Uruchamiaj przez `npm run test:lead-metrics`.
 *
 * Pilnuje, żeby ekrany znowu się nie rozjechały:
 *  1. „bez adresata" pomija odrzucone (status i kwalifikacja), zanonimizowane i przydzielone;
 *  2. „bez adresata" == liczba kart w lejku CRM kursantek bez kolumny „Odrzucona";
 *  3. duplikat po e-mailu (inna wielkość liter) = jedna osoba, kwota liczona od osób;
 *  4. zapisane = zapisana + rozliczony; konwersja od osób;
 *  5. „dziś" i wykres liczą dzień w Europe/Warsaw.
 */
import Module from "module";
import { sql } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = Module as any;
const origLoad = M._load;
M._load = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return origLoad.call(this, request, ...rest);
};

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "BLAD"}  ${label}${ok ? "" : ` — oczekiwano ${JSON.stringify(expected)}, jest ${JSON.stringify(actual)}`}`);
}

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  (globalThis as { __ubDb?: unknown }).__ubDb = Promise.resolve(db);

  const metrics = await import("../src/lib/lead-metrics-core");
  const pipeline = await import("../src/lib/pipeline-core");

  let n = 0;
  const mkLead = async (o: Partial<typeof schema.leads.$inferInsert> = {}) =>
    (
      await db
        .insert(schema.leads)
        .values({
          name: `Kursantka ${++n}`,
          phone: "500 600 700",
          email: `k${n}@example.com`,
          voivodeship: "mazowieckie",
          category: "Stylizacja brwi",
          employmentStatus: "pracuję",
          rodoConsentAt: new Date(),
          contactConsentAt: new Date(),
          ...o,
        })
        .returning()
    )[0];

  const [trainer] = await db
    .insert(schema.trainers)
    .values({ name: "La Beauty", slug: "la-beauty", city: "Kraków", voivodeship: "malopolskie" } as typeof schema.trainers.$inferInsert)
    .returning();

  // Czekają: 2 osoby, 3 rekordy (Anna dwa razy, raz wielkimi literami).
  await mkLead({ email: "anna@example.com" });
  await mkLead({ email: " Anna@Example.com " });
  await mkLead();
  // Nie czekają:
  await mkLead({ status: "odrzucony" });
  await mkLead({ qualification: "odrzucona" });
  await mkLead({ anonymizedAt: new Date() });
  const zPrzydzialem = await mkLead({ status: "zapisana" });
  const rozliczona = await mkLead({ status: "rozliczony" });
  for (const l of [zPrzydzialem, rozliczona]) {
    await db.insert(schema.leadAssignments).values({ leadId: l.id, trainerId: trainer.id, status: "zapisana" });
  }

  const m = await metrics.liczLeady(db);
  check("rekordy: wszystko, co wpłynęło", m.rekordy, 8);
  check("osoby: duplikat po e-mailu liczony raz", m.osoby, 7);
  check("bez adresata: rekordy", m.bezAdresata.rekordy, 3);
  check("bez adresata: osoby", m.bezAdresata.osoby, 2);
  check("na stole: 500 zł × osoby", m.bezAdresata.kwota, 1000);
  check("z przydziałem", m.zPrzydzialem, 2);
  check("zapisane = zapisana + rozliczony", m.zapisane, 2);
  check("konwersja od osób: 2/7", m.konwersja, 29);
  check("dziś: wszystkie 8 (wstawione teraz)", m.dzis, 8);

  const funnel = await pipeline.listFunnel(db);
  const otwarte = funnel.filter((f) => f.stage !== "odrzucona").length;
  check("CRM lejek (bez „Odrzucona”) == bez adresata", otwarte, m.bezAdresata.rekordy);

  // Lead z 23:30 czasu polskiego wczoraj NIE jest „dziś", choć w UTC bywa tym samym dniem.
  await db.execute(sql`
    insert into leads (name, phone, email, voivodeship, category, employment_status, rodo_consent_at, created_at)
    values ('Wczoraj', '1', 'w@example.com', 'mazowieckie', 'Inne', 'x', now(),
      (date_trunc('day', now() at time zone 'Europe/Warsaw') - interval '30 minutes') at time zone 'Europe/Warsaw')`);
  const m2 = await metrics.liczLeady(db);
  check("23:30 wczoraj (PL) nie wpada w „dziś”", m2.dzis, 8);
  const wykres = await metrics.naplywDzienny(db, 30);
  check("wykres: 30 dni", wykres.length, 30);
  check("wykres: dziś = 8, wczoraj = 1", [wykres[29].count, wykres[28].count], [8, 1]);
  check("wykres sumuje się z rekordami", wykres.reduce((s, d) => s + d.count, 0), m2.rekordy);

  console.log(failed ? `\n${failed} BŁĘDÓW` : "\nWSZYSTKO OK");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
