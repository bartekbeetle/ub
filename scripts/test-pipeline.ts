/**
 * Test CRM ADMINA (lejek + tablice trenerka × kategoria) na PGlite w pamięci — bez sieci, SMTP i Next.js.
 * Uruchamiaj przez `npm run test:pipeline`. Migracje lecą z ./drizzle jak na produkcji.
 *
 * Sprawdza:
 *  1. „Dodaj trenerkę" tworzy trenerkę BEZ umowy (autoAssign=false) i tablicę na każdą kategorię;
 *  2. przypisanie z lejka: karta na tablicy, kursantka znika z lejka, limit 3 trenerek, duplikat 409;
 *  3. rozliczenia: „Wpłaciła" nalicza DOKŁADNIE raz, etapy przed wpłatą nie ruszają kwoty,
 *     „Dotarła" nie nalicza drugi raz, cofnięcie z „Wpłaciła" tylko superadmin, rezygnacja wymaga powodu;
 *  4. 🔴 ZERO WYSYŁKI: ani przypisanie, ani naliczenie nie dokłada nic do email_queue;
 *  5. starsze przydziały bez tablicy pokazują się na tablicy po kategorii;
 *  6. straż strukturalna: trasy CRM admina mają requireAdmin, stara trasa przydziału nie maila bez umowy.
 */
import Module from "module";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { eq, sql } from "drizzle-orm";
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

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

async function main() {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  (globalThis as { __ubDb?: unknown }).__ubDb = Promise.resolve(db);

  const core = await import("../src/lib/pipeline-core");
  const st = await import("../src/lib/pipeline-stages");

  const audits: string[] = [];
  const audit = async (p: { action: string }) => {
    audits.push(p.action);
  };
  const admin = { id: 1, email: "admin@example.com" };
  const queueCount = async () =>
    ((await db.select({ n: sql<number>`count(*)::int` }).from(schema.emailQueue))[0]).n;

  // 0. Migracja
  const r = await client.query(`select to_regclass('public.crm_boards') as t`);
  check("tabela crm_boards istnieje", (r.rows[0] as { t: string | null }).t, "crm_boards");

  // ===== 1. ETAPY (czyste) =====
  check("mapowanie: przed wpłatą = skontaktowany", st.PIPELINE_STAGE_TO_STATUS.zapis, "skontaktowany");
  check("mapowanie: wpłaciła = zapisana (naliczenie)", st.PIPELINE_STAGE_TO_STATUS.wplacila, "zapisana");
  check("mapowanie: dotarła = zapisana", st.PIPELINE_STAGE_TO_STATUS.dotarla, "zapisana");
  check("etap sprzeczny ze statusem → wyprowadzony ze statusu", st.pipelineStageOf("zapisana", "rozmowa"), "wplacila");
  check("etap zgodny ze statusem zostaje", st.pipelineStageOf("skontaktowany", "wniosek_zlozony"), "wniosek_zlozony");
  check("każdy etap ma etykietę i kolor", st.PIPELINE_STAGES.every((s) => st.PIPELINE_STAGE_LABELS[s] && st.PIPELINE_STAGE_COLORS[s]), true);

  // ===== 2. DODAJ TRENERKĘ =====
  const bad = await core.createTrainerWithBoards(db, { name: "X", categories: [] }, { audit });
  check("bez kategorii → 400", bad.ok ? 0 : bad.status, 400);
  const badCat = await core.createTrainerWithBoards(db, { name: "La Beauty", categories: ["Kosmonautyka"] }, { audit });
  check("nieznana kategoria → 400", badCat.ok ? 0 : badCat.status, 400);
  const t = await core.createTrainerWithBoards(
    db,
    { name: "La Beauty", categories: ["Stylizacja brwi", "Stylizacja rzęs", "Stylizacja brwi"] },
    { audit }
  );
  if (!t.ok) throw new Error("createTrainerWithBoards");
  check("tablica na każdą kategorię (bez duplikatu)", t.boardIds.length, 2);
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, t.trainerId));
  check("trenerka BEZ umowy (autoAssign=false)", trainer.autoAssign, false);
  check("specjalizacje zapisane", trainer.specializations, ["Stylizacja brwi", "Stylizacja rzęs"]);
  const t2 = await core.createTrainerWithBoards(db, { name: "La Beauty", categories: ["Stylizacja paznokci"] }, { audit });
  check("drugi slug przy tej samej nazwie", t2.ok, true);
  const [trainer2] = t2.ok ? await db.select().from(schema.trainers).where(eq(schema.trainers.id, t2.trainerId)) : [];
  check("slug z sufiksem", trainer2?.slug, "la-beauty-2");
  const again = await core.addBoard(db, { trainerId: t.trainerId, category: "Stylizacja brwi" }, { audit });
  check("addBoard idempotentny (ta sama tablica)", again.ok && again.boardId, t.boardIds[0]);
  const extra = await core.addBoard(db, { trainerId: t.trainerId, category: "Stylizacja paznokci" }, { audit });
  check("addBoard: nowa kategoria = nowa tablica", extra.ok && !t.boardIds.includes(extra.boardId), true);
  const boards = await core.listBoards(db);
  check("lista tablic: 4 (3 La Beauty + 1 La Beauty 2)", boards.length, 4);

  // ===== 3. LEJEK + PRZYPISANIE =====
  const mkLead = async (o: Partial<typeof schema.leads.$inferInsert> = {}) =>
    (
      await db
        .insert(schema.leads)
        .values({
          name: "Daria Kowalska",
          phone: "500 600 700",
          email: "daria@example.com",
          voivodeship: "mazowieckie",
          category: "Stylizacja brwi",
          employmentStatus: "pracuję",
          rodoConsentAt: new Date(),
          contactConsentAt: new Date(),
          ...o,
        })
        .returning()
    )[0];
  const L1 = await mkLead();
  const L2 = await mkLead({ name: "Bez Zgody", contactConsentAt: null });
  let funnel = await core.listFunnel(db);
  check("lejek: 2 kursantki", funnel.length, 2);
  check("lejek: znacznik braku zgody na telefon", funnel.find((f) => f.id === L2.id)?.hasPhoneConsent, false);

  const q = await core.setQualification(db, L2.id, "odrzucona", { audit });
  check("kwalifikacja: odrzucona", q.ok, true);
  funnel = await core.listFunnel(db);
  check("lejek: odrzucona w kolumnie odrzucona", funnel.find((f) => f.id === L2.id)?.stage, "odrzucona");
  const [L2db] = await db.select().from(schema.leads).where(eq(schema.leads.id, L2.id));
  check("odrzucona → status leada odrzucony (spójność ze starym widokiem)", L2db.status, "odrzucony");
  await core.setQualification(db, L2.id, "nowa", { audit });
  const [L2back] = await db.select().from(schema.leads).where(eq(schema.leads.id, L2.id));
  check("cofnięcie odrzucenia → status nowy", L2back.status, "nowy");

  const boardBrwi = t.boardIds[0];
  const q0 = await queueCount();
  const a1 = await core.assignToBoard(db, { leadId: L1.id, boardId: boardBrwi, actor: "test" }, { audit });
  if (!a1.ok) throw new Error("assignToBoard");
  check("🔴 przypisanie NIE wrzuca maila do kolejki", await queueCount(), q0);
  funnel = await core.listFunnel(db);
  check("przypisana znika z lejka", funnel.some((f) => f.id === L1.id), false);
  const dup = await core.assignToBoard(db, { leadId: L1.id, boardId: boardBrwi, actor: "test" }, { audit });
  check("ta sama trenerka drugi raz → 409", dup.ok ? 0 : dup.status, 409);
  const [L1db] = await db.select().from(schema.leads).where(eq(schema.leads.id, L1.id));
  check("lead: status przydzielony + zakwalifikowana", [L1db.status, L1db.qualification], ["przydzielony", "zakwalifikowana"]);

  // limit 3 trenerek
  const others = await Promise.all(
    ["A", "B", "C"].map((n) => core.createTrainerWithBoards(db, { name: `Akademia ${n}`, categories: ["Stylizacja brwi"] }, { audit }))
  );
  const oBoards = others.map((o) => (o.ok ? o.boardIds[0] : 0));
  const r1 = await core.assignToBoard(db, { leadId: L1.id, boardId: oBoards[0], actor: "test" }, { audit });
  const r2 = await core.assignToBoard(db, { leadId: L1.id, boardId: oBoards[1], actor: "test" }, { audit });
  const r3 = await core.assignToBoard(db, { leadId: L1.id, boardId: oBoards[2], actor: "test" }, { audit });
  check("limit 3 trenerek: 2 przechodzą, czwarta 409", [r1.ok, r2.ok, r3.ok ? 0 : r3.status], [true, true, 409]);

  let cards = await core.listBoardCards(db, boardBrwi);
  check("karta na tablicy w kolumnie Przypisana", cards?.map((c) => c.stage), ["przypisana"]);

  // ===== 4. CYKL + ROZLICZENIA =====
  const move = (to: string, extra: { reason?: string; canUndoSigned?: boolean } = {}) =>
    core.moveCard(
      db,
      { user: admin, canUndoSigned: extra.canUndoSigned ?? false, boardId: boardBrwi, assignmentId: a1.assignmentId, to: to as never, reason: extra.reason },
      { audit }
    );
  const amount = async () =>
    (await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.id, a1.assignmentId)))[0];

  for (const s of ["nie_odbiera", "dzwonilem", "odpowiedziala", "rozmowa", "wniosek_w_trakcie", "wniosek_zlozony", "zapis"]) {
    const res = await move(s);
    if (!res.ok) check(`przejście na ${s}`, res, "ok");
  }
  let a = await amount();
  check("etapy przed wpłatą: status skontaktowany, kwota 0", [a.status, a.amount, a.adminStage], ["skontaktowany", 0, "zapis"]);

  const q1 = await queueCount();
  const paid = await move("wplacila");
  a = await amount();
  check("Wpłaciła: nalicza stawkę trenerki (500)", [paid.ok, a.status, a.amount], [true, "zapisana", 500]);
  check("🔴 naliczenie NIE wrzuca maila do kolejki", await queueCount(), q1);
  const [L1paid] = await db.select().from(schema.leads).where(eq(schema.leads.id, L1.id));
  check("lead eskalowany do zapisana", L1paid.status, "zapisana");

  await db.update(schema.trainers).set({ rate: 999 }).where(eq(schema.trainers.id, t.trainerId));
  const came = await move("dotarla");
  a = await amount();
  check("Dotarła: nie nalicza drugi raz (kwota bez zmian)", [came.ok, a.amount, a.adminStage], [true, 500, "dotarla"]);

  const back = await move("zapis");
  check("cofnięcie z naliczonego bez superadmina → 403", back.ok ? 0 : back.status, 403);
  const noReason = await move("rezygnacja", { canUndoSigned: true });
  check("rezygnacja bez powodu → 400", noReason.ok ? 0 : noReason.status, 400);
  const undo = await move("zapis", { canUndoSigned: true });
  a = await amount();
  check("superadmin cofa: kwota 0, status skontaktowany", [undo.ok, a.amount, a.status], [true, 0, "skontaktowany"]);
  check("audyt: naliczenie i cofnięcie przez wspólny rdzeń", audits.includes("zmiana_statusu_przydzialu") && audits.includes("cofniecie_zapisu"), true);

  cards = await core.listBoardCards(db, boardBrwi);
  check("oś czasu: ostatnie zdarzenie na karcie", cards?.[0]?.lastEvent?.startsWith("Etap:"), true);

  // obca karta przez obcą tablicę → 404
  const foreign = await core.moveCard(
    db,
    { user: admin, canUndoSigned: true, boardId: t.boardIds[1], assignmentId: a1.assignmentId, to: "rozmowa" },
    { audit }
  );
  check("karta z innej tablicy → 404", foreign.ok ? 0 : foreign.status, 404);

  // ===== 5. STARE PRZYDZIAŁY BEZ TABLICY =====
  const L3 = await mkLead({ name: "Stara", category: "Stylizacja rzęs" });
  await db.insert(schema.leadAssignments).values({ leadId: L3.id, trainerId: t.trainerId, status: "skontaktowany" });
  const rzesy = await core.listBoardCards(db, t.boardIds[1]);
  check("stary przydział bez tablicy widoczny po kategorii", rzesy?.map((c) => [c.name, c.stage]), [["Stara", "dzwonilem"]]);
  const brwiAfter = await core.listBoardCards(db, boardBrwi);
  check("…i nie wpada na tablicę innej kategorii", brwiAfter?.some((c) => c.name === "Stara"), false);

  // ===== 6. STRAŻ STRUKTURALNA =====
  const routes = walk("src/app/api/admin/crm-kursantki");
  check("są trasy CRM admina", routes.length > 0, true);
  for (const f of routes) {
    const src = readFileSync(f, "utf8");
    check(`${f}: requireAdmin`, /requireAdmin\(\)/.test(src), true);
    check(`${f}: brak wysyłki`, /sendOrQueueEmail|getSmsProvider|emailQueue/.test(src), false);
  }
  const coreSrc = readFileSync("src/lib/pipeline-core.ts", "utf8");
  check("rdzeń CRM admina nie importuje maili/SMS", /@\/lib\/email|@\/lib\/sms|lead-events/.test(coreSrc), false);
  const page = readFileSync("src/app/admin/(panel)/crm-kursantki/page.tsx", "utf8");
  const gateAt = page.indexOf('redirect("/admin/login")');
  check("strona: bramka z przekierowaniem PRZED zapytaniami", gateAt > 0 && gateAt < page.indexOf("await pipeline"), true);
  const oldAssign = readFileSync("src/app/api/admin/leads/[id]/assign/route.ts", "utf8");
  check("stara trasa przydziału: mail do trenerki tylko z umową (autoAssign)", /trainer\.autoAssign && trainer\.email/.test(oldAssign), true);

  console.log(failed === 0 ? "\nWSZYSTKO OK" : `\nNIEPOWODZENIA: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
