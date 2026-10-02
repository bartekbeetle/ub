/**
 * Test CRM trenerki na PGlite w pamięci — BEZ sieci, BEZ Next.js, BEZ ./.pglite, BEZ SMTP.
 * Migracje lecą z ./drizzle jak na produkcji.
 *
 * Uruchamiaj przez `npm run test:crm`. Pakiet `server-only` jest podstawiany pustym modułem, dzięki czemu
 * test woła PRAWDZIWĄ wspólną funkcję naliczającą (`@/lib/assignment-status`) i prawdziwe wiring `@/lib/crm`.
 *
 * Sprawdza:
 *  1. izolację: trenerka B nie czyta ani nie pisze w przydziale A (karta, etap, notatki, przypomnienie,
 *     e-mail, SMS, szablony), a jej widok nie zawiera niczego z danych A ani statusu leada;
 *  2. rozliczenia: etap „zapisana" idzie przez wspólną funkcję, nalicza dokładnie raz, etapy
 *     wewnątrz „skontaktowany" nie ruszają statusu, zmiana statusu z telefonu nie rozjeżdża etapu;
 *  3. SMS: dry-run, zgoda, normalizacja numeru, licznik znaków, limit dzienny, sterownik SMSAPI;
 *  4. e-mail: nadawca/Reply-To w kolejce, brak dedupe, znaczniki, limit dzienny, nagłówki;
 *  5. szablony, RODO (purge), podgląd admina;
 *  6. straż strukturalna: każda trasa i strona CRM ma bramkę sesji, nic nie czyta pól UB z leada.
 */
import Module from "module";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { and, eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";

// `server-only` to pakiet-wartownik Next.js, którego nie ma w node_modules; poza Next podstawiamy pusty moduł.
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
  // Bez SMTP: maile zostają w kolejce (jak na produkcji przed ustawieniem haseł).
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMSAPI_TOKEN;

  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  // Wspólny singleton bazy — `@/lib/assignment-status`, `@/lib/lead-events` i `@/lib/settings` czytają go przez getDb().
  (globalThis as { __ubDb?: unknown }).__ubDb = Promise.resolve(db);

  const core = await import("../src/lib/crm-core");
  const crm = await import("../src/lib/crm");
  const stages = await import("../src/lib/crm-stages");
  const { updateTrainerAssignmentStatus } = await import("../src/lib/assignment-status");
  const { getSmsProvider, isSmsLive } = await import("../src/lib/sms");
  const { normalizePlPhone, smsLength } = await import("../src/lib/sms/phone");
  const { SmsapiProvider } = await import("../src/lib/sms/smsapi");
  const { safeDisplayName, extractAddress } = await import("../src/lib/email");

  // 0. Migracja
  for (const t of ["crm_notes", "crm_events", "crm_messages", "crm_templates"]) {
    const r = await client.query(`select to_regclass('public.${t}') as t`);
    check(`tabela ${t} istnieje`, (r.rows[0] as { t: string | null }).t, t);
  }

  // ===== DANE =====
  const mkTrainer = async (name: string, active = true) =>
    (await db.insert(schema.trainers).values({ slug: name.toLowerCase().replace(/\W+/g, "-"), name, isActive: active, billingModel: "per_zapis", rate: 500 }).returning())[0];
  const mkUser = async (email: string, trainerId: number) =>
    (await db.insert(schema.users).values({ email, passwordHash: "x", role: "trenerka", trainerId }).returning())[0];

  const tA = await mkTrainer("Akademia Alfa");
  const tB = await mkTrainer("Akademia Beta");
  const tC = await mkTrainer("Akademia Gamma (przed aktywacją)", false);
  const uA = await mkUser("alfa@example.com", tA.id);
  const uB = await mkUser("beta@example.com", tB.id);
  const uC = await mkUser("gamma@example.com", tC.id);

  const course = (await db.insert(schema.courses).values({ slug: "pmu-podstawy", title: "Makijaż permanentny ust", category: "Makijaż permanentny", price: 5000 } as never).returning())[0];

  const lead = async (o: Partial<typeof schema.leads.$inferInsert> = {}) =>
    (
      await db
        .insert(schema.leads)
        .values({
          name: "Gabriela Nowak",
          phone: "500 600 700",
          email: "gabriela@example.com",
          voivodeship: "mazowieckie",
          category: "Makijaż permanentny",
          employmentStatus: "pracuję",
          rodoConsentAt: new Date(),
          contactConsentAt: new Date(),
          notes: "WEWNETRZNA-NOTATKA-UB",
          utmSource: "UTM-SEKRET",
          courseId: course.id,
          ...o,
        })
        .returning()
    )[0];
  const assign = async (leadId: number, trainerId: number) =>
    (await db.insert(schema.leadAssignments).values({ leadId, trainerId }).returning())[0];

  const L = await lead(); // multi-sell: ta sama kobieta u A i B
  const aAL = await assign(L.id, tA.id);
  const aBL = await assign(L.id, tB.id);
  const M = await lead({ name: "Maria Bez Zgody", phone: "501 111 222", email: "maria@example.com", contactConsentAt: null, courseId: null });
  const aAM = await assign(M.id, tA.id);
  const aCL = await assign(L.id, tC.id);

  // ===== 1. ETAPY =====
  check("nowa <- przydzielony", stages.crmStageOf("przydzielony", null), "nowa");
  check("skontaktowany bez podetapu -> kontakt_podjety", stages.crmStageOf("skontaktowany", null), "kontakt_podjety");
  check("skontaktowany + wniosek_bur", stages.crmStageOf("skontaktowany", "wniosek_bur"), "wniosek_bur");
  check("śmieciowy podetap ignorowany", stages.crmStageOf("skontaktowany", "cokolwiek"), "kontakt_podjety");
  check("zapisana", stages.crmStageOf("zapisana", "wniosek_bur"), "zapisana");
  check("odrzucony -> rezygnacja", stages.crmStageOf("odrzucony", null), "rezygnacja");
  check("mapowanie: tylko 3 etapy -> skontaktowany", stages.CRM_STAGES.filter((s) => stages.CRM_STAGE_TO_STATUS[s] === "skontaktowany"), ["kontakt_podjety", "rozmowa_umowiona", "wniosek_bur"]);

  // ===== 2. IZOLACJA =====
  // A zapisuje swoje dane
  const noteA = await core.addNote(db, tA.id, aAL.id, "TAJNA-NOTATKA-ALFY");
  check("A dodaje notatkę do własnego przydziału", noteA.ok, true);
  check("A ustawia przypomnienie", (await core.setReminder(db, tA.id, aAL.id, "2026-10-05")).ok, true);
  const tplA = await core.createTemplate(db, tA.id, { channel: "email", name: "Powitanie Alfy", subject: "Temat-ALFY {imie}", body: "Treść-ALFY {kurs}" });
  check("A tworzy szablon", tplA.ok, true);
  const mailA = await crm.crmSendEmail(uA, aAL.id, "Cześć {imie}", "Szkolenie: {kurs}. Pozdrawiam, ALFA-UNIKAT");
  check("A wysyła e-mail do Gabrieli", mailA.ok, true);

  // B próbuje dotknąć przydziału A — każda ścieżka = 404 i ZERO zapisów
  const before = {
    notes: (await db.select().from(schema.crmNotes)).length,
    events: (await db.select().from(schema.crmEvents)).length,
    msgs: (await db.select().from(schema.crmMessages)).length,
    queue: (await db.select().from(schema.emailQueue)).length,
  };
  check("B: getOwnedAssignment(A) = null", await core.getOwnedAssignment(db, tB.id, aAL.id), null);
  check("B: getCrmDetail(A) = null", await core.getCrmDetail(db, tB.id, aAL.id), null);
  const bStage = await crm.crmChangeStage(uB, aAL.id, { stage: "zapisana" });
  check("B: zmiana etapu cudzego = 404", bStage.ok === false && bStage.status, 404);
  const bNote = await core.addNote(db, tB.id, aAL.id, "wtargnięcie");
  check("B: notatka do cudzego = 404", bNote.ok === false && bNote.status, 404);
  const bRem = await core.setReminder(db, tB.id, aAL.id, "2026-10-06");
  check("B: przypomnienie na cudzym = 404", bRem.ok === false && bRem.status, 404);
  const bMail = await crm.crmSendEmail(uB, aAL.id, "x", "y");
  check("B: e-mail z cudzego przydziału = 404", bMail.ok === false && bMail.status, 404);
  const bSms = await crm.crmSendSms(uB, aAL.id, "x");
  check("B: SMS z cudzego przydziału = 404", bSms.ok === false && bSms.status, 404);
  check("B: nieistniejący przydział = taki sam 404", (await core.addNote(db, tB.id, 999999, "x")).ok === false && ((await core.addNote(db, tB.id, 999999, "x")) as { status: number }).status, 404);
  const after = {
    notes: (await db.select().from(schema.crmNotes)).length,
    events: (await db.select().from(schema.crmEvents)).length,
    msgs: (await db.select().from(schema.crmMessages)).length,
    queue: (await db.select().from(schema.emailQueue)).length,
  };
  check("B: żadnych zapisów po próbach wtargnięcia", after, before);
  const assignAAfter = (await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.id, aAL.id)))[0];
  check("B: przydział A nietknięty (status, przypomnienie)", [assignAAfter.status, assignAAfter.nextContactAt !== null], ["przydzielony", true]);

  // Szablony: B nie edytuje i nie kasuje cudzego, nie widzi na liście
  const tplId = (tplA as { id: number }).id;
  const bUpd = await core.updateTemplate(db, tB.id, tplId, { channel: "email", name: "hack", subject: "", body: "hack" });
  check("B: edycja cudzego szablonu = 404", bUpd.ok === false && bUpd.status, 404);
  const bDel = await core.deleteTemplate(db, tB.id, tplId);
  check("B: usunięcie cudzego szablonu = 404", bDel.ok === false && bDel.status, 404);
  check("B: lista szablonów pusta", (await core.listTemplates(db, tB.id)).length, 0);
  check("A: szablon przetrwał", (await core.listTemplates(db, tA.id)).length, 1);

  // Widok B tej samej kobiety nie niesie niczego z danych A
  const detB = await core.getCrmDetail(db, tB.id, aBL.id);
  const jsonB = JSON.stringify(detB) + JSON.stringify(await core.listCrmLeads(db, tB.id));
  for (const secret of ["TAJNA-NOTATKA-ALFY", "ALFA-UNIKAT", "Akademia Alfa", "alfa@example.com", "Temat-ALFY", "WEWNETRZNA-NOTATKA-UB", "UTM-SEKRET"]) {
    check(`widok B nie zawiera „${secret}"`, jsonB.includes(secret), false);
  }
  check("B: oś czasu pusta (cudze wiadomości i notatki nie przeciekają)", detB?.timeline.length, 0);
  check("B: lista = tylko własne przydziały", (await core.listCrmLeads(db, tB.id)).map((i) => i.assignmentId), [aBL.id]);
  check("A: lista = własne dwa przydziały", (await core.listCrmLeads(db, tA.id)).map((i) => i.assignmentId).sort(), [aAL.id, aAM.id].sort());
  const ownedKeys = Object.keys((await core.getOwnedAssignment(db, tA.id, aAL.id))!.lead).sort();
  check("LeadView ma ściśle wskazane pola (bez status/notes/utm)", ownedKeys, ["anonymized", "category", "city", "courseTitle", "email", "employmentStatus", "message", "name", "phone", "phoneConsent", "preferredDate", "voivodeship"]);

  // ===== 3. ROZLICZENIA =====
  // Etapy wewnątrz „skontaktowany" — status zmienia się RAZ (przydzielony -> skontaktowany), potem nie.
  const audits = async () => (await db.select().from(schema.auditLog)).length;
  const r1 = await crm.crmChangeStage(uA, aAL.id, { stage: "kontakt_podjety" });
  check("A: nowa -> kontakt_podjety", r1.ok, true);
  let row = (await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.id, aAL.id)))[0];
  check("status = skontaktowany, bez naliczenia", [row.status, row.amount], ["skontaktowany", 0]);
  const auditsBefore = await audits();
  const r2 = await crm.crmChangeStage(uA, aAL.id, { stage: "rozmowa_umowiona" });
  const r3 = await crm.crmChangeStage(uA, aAL.id, { stage: "wniosek_bur" });
  check("A: kontakt -> rozmowa -> wniosek BUR", [r2.ok, r3.ok], [true, true]);
  row = (await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.id, aAL.id)))[0];
  check("etapy wewnętrzne NIE ruszają statusu, kwoty ani audit_log", [row.status, row.amount, row.crmSubstage, await audits()], ["skontaktowany", 0, "wniosek_bur", auditsBefore]);
  check("etap widoczny w CRM = wniosek_bur", (await core.getCrmDetail(db, tA.id, aAL.id))?.stage, "wniosek_bur");

  // Rezygnacja wymaga powodu
  const noReason = await crm.crmChangeStage(uA, aAM.id, { stage: "rezygnacja" });
  check("rezygnacja bez powodu = 400", noReason.ok === false && noReason.status, 400);
  const withReason = await crm.crmChangeStage(uA, aAM.id, { stage: "rezygnacja", rejectionReason: "Zmieniła plany" });
  check("rezygnacja z powodem", withReason.ok, true);
  const rowM = (await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.id, aAM.id)))[0];
  check("rezygnacja -> status odrzucony + powód", [rowM.status, rowM.rejectionReason], ["odrzucony", "Zmieniła plany"]);

  // ZAPISANA przez CRM = wspólna funkcja naliczająca
  const signed = await crm.crmChangeStage(uA, aAL.id, { stage: "zapisana" });
  check("A: etap zapisana", signed.ok, true);
  row = (await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.id, aAL.id)))[0];
  check("naliczono stawkę trenerki (500) dokładnie raz", [row.status, row.amount], ["zapisana", 500]);
  const leadAfter = (await db.select().from(schema.leads).where(eq(schema.leads.id, L.id)))[0];
  check("status leada zeskalowany do zapisana (jak w panelu/telefonie)", leadAfter.status, "zapisana");
  const kinds = async () => (await db.select({ k: schema.emailQueue.kind }).from(schema.emailQueue)).map((r) => r.k).sort();
  const k1 = await kinds();
  check("maile zapisu: 1x do kursantki, 1x wewnętrzny", [k1.filter((k) => k === "kursantka_zapis").length, k1.filter((k) => k === "wewnetrzne_zapis").length], [1, 1]);
  const billingAudit = (await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "zmiana_statusu"))).length;
  check("audit_log: jedno przejście na zapisana", billingAudit, 1);

  // Powtórka nie nalicza drugi raz — przez CRM i przez ścieżkę „telefonu"/panelu
  const again = await crm.crmChangeStage(uA, aAL.id, { stage: "zapisana" });
  const direct = await updateTrainerAssignmentStatus({ user: uA, trainerId: tA.id, assignmentId: aAL.id, input: { status: "zapisana" } });
  check("powtórka etapu i status z telefonu: ok, bez błędu", [again.ok, direct.ok], [true, true]);
  row = (await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.id, aAL.id)))[0];
  const k2 = await kinds();
  check("nadal 500 zł, te same maile i audit (naliczone raz)", [row.amount, k2.length === k1.length, (await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "zmiana_statusu"))).length], [500, true, 1]);
  const back = await crm.crmChangeStage(uA, aAL.id, { stage: "kontakt_podjety" });
  check("wyjście z zapisanej przez CRM zablokowane (409)", back.ok === false && back.status, 409);
  check("po blokadzie kwota i status bez zmian", (await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.id, aAL.id)))[0].amount, 500);

  // Status zmieniony poza CRM (telefon) -> etap w CRM wynika ze statusu, nic się nie rozjeżdża
  await updateTrainerAssignmentStatus({ user: uB, trainerId: tB.id, assignmentId: aBL.id, input: { status: "skontaktowany" } });
  check("status z telefonu -> CRM pokazuje kontakt_podjety", (await core.getCrmDetail(db, tB.id, aBL.id))?.stage, "kontakt_podjety");
  await updateTrainerAssignmentStatus({ user: uB, trainerId: tB.id, assignmentId: aBL.id, input: { status: "zapisana" } });
  check("status zapisana z telefonu -> CRM pokazuje zapisana (bez zapisu w CRM)", (await core.getCrmDetail(db, tB.id, aBL.id))?.stage, "zapisana");
  check("multi-sell: B też naliczone 500 niezależnie od A", (await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.id, aBL.id)))[0].amount, 500);

  // Bramka onboardingu
  const gate = await crm.crmChangeStage(uC, aCL.id, { stage: "kontakt_podjety" });
  check("konto przed aktywacją: etap = 403", gate.ok === false && gate.status, 403);
  check("konto przed aktywacją: notatka = 403", (await core.addNote(db, tC.id, aCL.id, "x")).ok === false, true);
  check("konto przed aktywacją: e-mail = 403", ((await crm.crmSendEmail(uC, aCL.id, "a", "b")) as { status?: number }).status, 403);
  check("konto przed aktywacją: SMS = 403", ((await crm.crmSendSms(uC, aCL.id, "a")) as { status?: number }).status, 403);

  // ===== 4. SMS =====
  check("normalize: spacje", normalizePlPhone("500 600 700"), { ok: true, e164: "+48500600700" });
  check("normalize: +48", normalizePlPhone("+48 500-600-700"), { ok: true, e164: "+48500600700" });
  check("normalize: 0048", normalizePlPhone("0048500600700"), { ok: true, e164: "+48500600700" });
  check("normalize: 48 bez plusa", normalizePlPhone("48500600700"), { ok: true, e164: "+48500600700" });
  check("normalize: stacjonarny odrzucony", normalizePlPhone("22 123 45 67").ok, false);
  check("normalize: zagraniczny odrzucony", normalizePlPhone("+44 7911 123456").ok, false);
  check("normalize: śmieci odrzucone", normalizePlPhone("abc").ok, false);
  check("licznik: 160 znaków GSM = 1 część", smsLength("a".repeat(160)).segments, 1);
  check("licznik: 161 znaków GSM = 2 części", smsLength("a".repeat(161)).segments, 2);
  check("licznik: polska litera => unicode, limit 70", [smsLength("ą" + "a".repeat(69)).unicode, smsLength("ą" + "a".repeat(69)).segments], [true, 1]);
  check("licznik: 71 znaków z polską literą = 2 części", smsLength("ą" + "a".repeat(70)).segments, 2);
  check("licznik: pusty = 0 części", smsLength("").segments, 0);

  check("bez tokenu: dostawca dryrun, nie live", [getSmsProvider({}).name, isSmsLive({})], ["dryrun", false]);
  check("z tokenem: dostawca smsapi, live", [getSmsProvider({ SMSAPI_TOKEN: "t" }).name, isSmsLive({ SMSAPI_TOKEN: "t" })], ["smsapi", true]);

  const sms1 = await crm.crmSendSms(uA, aAL.id, "Dzień dobry {imie}, tu Akademia Alfa. Dzwonię w sprawie: {kurs}.");
  check("SMS dry-run: ok, status dry-run, provider dryrun", [sms1.ok, (sms1 as { status?: string }).status, (sms1 as { provider?: string }).provider], [true, "dry-run", "dryrun"]);
  const smsRow = (await db.select().from(schema.crmMessages).where(and(eq(schema.crmMessages.channel, "sms"), eq(schema.crmMessages.assignmentId, aAL.id))))[0];
  check("SMS zapisany w historii: numer +48, znaczniki podstawione, części", [smsRow.toAddress, smsRow.body, smsRow.status, smsRow.segments], ["+48500600700", "Dzień dobry Gabrielo, tu Akademia Alfa. Dzwonię w sprawie: Makijaż permanentny ust.", "dry-run", 2]);
  check("SMS dry-run widoczny w osi czasu", (await core.getCrmDetail(db, tA.id, aAL.id))?.timeline.some((t) => t.type === "sms" && t.message?.status === "dry-run"), true);

  // Brak zgody na telefon (aAM jest po rezygnacji, ale zgoda dotyczy leada)
  const msgsBefore = (await db.select().from(schema.crmMessages)).length;
  const noConsent = await crm.crmSendSms(uA, aAM.id, "Dzień dobry");
  check("SMS bez zgody na kontakt = 403 i zero zapisów", [noConsent.ok === false && noConsent.status, (await db.select().from(schema.crmMessages)).length], [403, msgsBefore]);
  const tooLong = await crm.crmSendSms(uA, aAL.id, "ą".repeat(300));
  check("SMS za długi (>3 części) = 400", tooLong.ok === false && tooLong.status, 400);

  // Limit dzienny SMS (okno 24 h liczone z bazy)
  const t0 = new Date("2026-11-01T10:00:00Z");
  const dry = getSmsProvider({});
  const startCount = await core.countSentLast24h(db, tA.id, "sms", t0);
  let lastRes: { ok: boolean; status?: number } = { ok: true };
  // dobijamy do limitu (część wiadomości już jest — liczymy ile brakuje)
  for (let i = startCount; i < core.SMS_DAILY_LIMIT; i++) {
    lastRes = await core.sendCrmSms(db, { trainerId: tA.id, assignmentId: aAL.id, text: `SMS ${i}`, now: t0 }, { provider: dry });
  }
  check("SMS: do limitu wszystko przechodzi", lastRes.ok, true);
  const over = await core.sendCrmSms(db, { trainerId: tA.id, assignmentId: aAL.id, text: "ponad limit", now: t0 }, { provider: dry });
  check(`SMS: ${core.SMS_DAILY_LIMIT}+1 = 429`, over.ok === false && over.status, 429);
  const nextDay = new Date(t0.getTime() + 25 * 3600_000);
  const okLater = await core.sendCrmSms(db, { trainerId: tA.id, assignmentId: aAL.id, text: "po dobie", now: nextDay }, { provider: dry });
  check("SMS: po 25 h limit się odnawia", okLater.ok, true);
  check("SMS: limit jest per trenerka (B nie ucierpiała)", await core.countSentLast24h(db, tB.id, "sms", t0), 0);

  // Sterownik SMSAPI na atrapie fetch
  const calls: { url: string; init: RequestInit }[] = [];
  const mkFetch = (impl: (url: string) => Promise<Response>) => (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return impl(url);
  }) as unknown as typeof fetch;
  const okApi = new SmsapiProvider("TOKEN123", "UBeauty", mkFetch(async () => new Response(JSON.stringify({ count: 1, list: [{ id: "1460969715572091219", points: 0.16, status: "QUEUE" }] }), { status: 200 })));
  const resOk = await okApi.send("+48500600700", "Zażółć gęślą");
  const body = new URLSearchParams(String(calls[0].init.body));
  check("SMSAPI sukces: id + status sent", [resOk.id, resOk.status], ["1460969715572091219", "sent"]);
  check("SMSAPI żądanie: URL, Bearer, numer bez plusa, utf-8, nadawca, json", [
    calls[0].url, (calls[0].init.headers as Record<string, string>).Authorization, body.get("to"), body.get("encoding"), body.get("from"), body.get("format"), body.get("normalize"), body.get("fast"),
  ], ["https://api.smsapi.pl/sms.do", "Bearer TOKEN123", "48500600700", "utf-8", "UBeauty", "json", null, null]);
  const errApi = new SmsapiProvider("t", undefined, mkFetch(async () => new Response(JSON.stringify({ error: 13, message: "No correct phone numbers", invalid_numbers: [{ message: "Invalid phone number" }] }), { status: 200 })));
  const resErr = await errApi.send("+48500600700", "x");
  check("SMSAPI błąd biznesowy -> failed z kodem", [resErr.status, resErr.error], ["failed", "SMSAPI 13: Invalid phone number"]);
  calls.length = 0;
  const netApi = new SmsapiProvider("t", undefined, mkFetch(async () => { throw new Error("ECONNRESET"); }));
  const resNet = await netApi.send("+48500600700", "x");
  check("SMSAPI błąd sieci: próba backupu api2, potem failed", [calls.map((c) => c.url), resNet.status], [["https://api.smsapi.pl/sms.do", "https://api2.smsapi.pl/sms.do"], "failed"]);
  check("SMSAPI bez nadawcy: brak pola from", new URLSearchParams(String(calls[0].init.body)).has("from"), false);
  const sentSms = await core.sendCrmSms(db, { trainerId: tB.id, assignmentId: aBL.id, text: "Test", now: nextDay }, { provider: okApi });
  check("CRM + SMSAPI: status wyslany, providerId zapisany", [sentSms.ok, (await db.select().from(schema.crmMessages).where(eq(schema.crmMessages.trainerId, tB.id)))[0].providerId], [true, "1460969715572091219"]);
  const failSms = await core.sendCrmSms(db, { trainerId: tB.id, assignmentId: aBL.id, text: "Test2", now: nextDay }, { provider: errApi });
  check("CRM + błąd bramki: 502 i wiersz z błędem (widać w historii)", [failSms.ok === false && failSms.status, (await db.select().from(schema.crmMessages).where(and(eq(schema.crmMessages.trainerId, tB.id), eq(schema.crmMessages.status, "blad")))).length], [502, 1]);

  // ===== 5. E-MAIL =====
  const q = async () => db.select().from(schema.emailQueue).where(eq(schema.emailQueue.kind, "trenerka_crm"));
  const first = (await q())[0];
  check("e-mail A w kolejce: nadawca „Akademia przez UB", first.fromName, "Akademia Alfa przez Uniwersytet Beauty");
  check("e-mail A: Reply-To = konto trenerki", first.replyTo, "alfa@example.com");
  check("e-mail A: znaczniki podstawione w temacie i treści", [first.subject, first.body.includes("Szkolenie: Makijaż permanentny ust.")], ["Cześć Gabrielo", true]);
  check("e-mail A: stopka z nazwą akademii", first.body.includes("Akademia Alfa") && first.body.includes("w imieniu akademii"), true);
  check("e-mail: bez SMTP czeka w kolejce, status w CRM = w_kolejce", (mailA as { status?: string }).status, "w_kolejce");
  const mailA2 = await crm.crmSendEmail(uA, aAL.id, "Drugi mail", "Kolejna wiadomość od Alfy");
  const mailB = await crm.crmSendEmail(uB, aBL.id, "Mail Bety", "Wiadomość od Bety");
  check("brak dedupe: 3 maile CRM do tego samego leada (2x A, 1x B)", [mailA2.ok, mailB.ok, (await q()).length], [true, true, 3]);
  check("e-mail B: własny nadawca i Reply-To", (await q()).filter((r) => r.fromName === "Akademia Beta przez Uniwersytet Beauty" && r.replyTo === "beta@example.com").length, 1);
  check("oś czasu B zawiera tylko jej mail", (await core.getCrmDetail(db, tB.id, aBL.id))?.timeline.filter((t) => t.type === "email").map((t) => t.message?.subject), ["Mail Bety"]);
  // status w osi czasu żywo z kolejki
  const firstQueueId = (await db.select().from(schema.crmMessages).where(and(eq(schema.crmMessages.assignmentId, aAL.id), eq(schema.crmMessages.channel, "email"))))[0].emailQueueId!;
  await db.update(schema.emailQueue).set({ status: "wyslany" }).where(eq(schema.emailQueue.id, firstQueueId));
  check("status e-maila w osi czasu = żywy stan kolejki", (await core.getCrmDetail(db, tA.id, aAL.id))?.timeline.find((t) => t.message?.subject === "Cześć Gabrielo")?.message?.status, "wyslany");
  check("walidacja: pusty temat = 400", ((await crm.crmSendEmail(uA, aAL.id, "  ", "treść")) as { status?: number }).status, 400);
  check("kind TRENERKA_CRM nie jest idempotentny w alreadyQueued (dedupe:false)", (await q()).every((r) => r.kind === "trenerka_crm"), true);
  check("safeDisplayName usuwa CR/LF i cudzysłowy (wstrzyknięcie nagłówka)", safeDisplayName('Evil"\r\nBcc: x@y.pl'), "Evil Bcc: x@y.pl");
  check("extractAddress: z „Nazwa <adres>”", [extractAddress("UB <szkolenia@ub.pl>"), extractAddress("szkolenia@ub.pl")], ["szkolenia@ub.pl", "szkolenia@ub.pl"]);

  // limit dzienny e-mail (rdzeń z atrapą kolejki — 50 pełnych przebiegów nie jest potrzebne)
  const fakeEnqueue = async () => ({ queueId: undefined });
  const eStart = await core.countSentLast24h(db, tB.id, "email", t0);
  let eLast: { ok: boolean; status?: number } = { ok: true };
  for (let i = eStart; i < core.EMAIL_DAILY_LIMIT; i++) {
    eLast = await core.sendCrmEmail(db, { trainerId: tB.id, accountEmail: "beta@example.com", assignmentId: aBL.id, subject: `T${i}`, body: "b", now: t0 }, { enqueue: fakeEnqueue });
  }
  check("e-mail: do limitu przechodzi", eLast.ok, true);
  const eOver = await core.sendCrmEmail(db, { trainerId: tB.id, accountEmail: "beta@example.com", assignmentId: aBL.id, subject: "ponad", body: "b", now: t0 }, { enqueue: fakeEnqueue });
  check(`e-mail: ${core.EMAIL_DAILY_LIMIT}+1 = 429`, eOver.ok === false && eOver.status, 429);
  check("e-mail: limit niezależny od SMS i od innej trenerki (A wysyła)", (await core.sendCrmEmail(db, { trainerId: tA.id, accountEmail: "alfa@example.com", assignmentId: aAL.id, subject: "A", body: "b", now: t0 }, { enqueue: fakeEnqueue })).ok, true);

  // ===== 6. SZABLONY =====
  check("renderCrmTemplate: {imie} i {kurs}", stages.renderCrmTemplate("Hej {imie}, {kurs}! {nieznany} {imie}", { imie: "Anno", kurs: "PMU" }), "Hej Anno, PMU! {nieznany} Anno");
  check("renderCrmTemplate: nie rusza {{podwójnych}} UB", stages.renderCrmTemplate("{{imie}}", { imie: "A", kurs: "K" }), "{A}");
  check("templateVars: kurs z courseId, a gdy brak — kategoria", [core.templateVars({ name: "Kasia Kot", courseTitle: "PMU", category: "Brwi" }), core.templateVars({ name: "Kasia Kot", courseTitle: null, category: "Brwi" })], [{ imie: "Kasiu", kurs: "PMU" }, { imie: "Kasiu", kurs: "Brwi" }]);
  const upd = await core.updateTemplate(db, tA.id, tplId, { channel: "email", name: "Powitanie v2", subject: "T", body: "B" });
  check("A: edycja własnego szablonu", upd.ok, true);
  check("szablon: pusta nazwa = 400", ((await core.createTemplate(db, tA.id, { channel: "email", name: " ", body: "x" })) as { status?: number }).status, 400);
  check("A: usunięcie własnego szablonu", (await core.deleteTemplate(db, tA.id, tplId)).ok, true);

  // ===== 7. FILTRY LISTY =====
  const all = await core.listCrmLeads(db, tA.id, { now: new Date("2026-10-05T08:00:00Z") });
  check("przypomnienie na dziś = due (przydział aktywny)", all.find((i) => i.assignmentId === aAL.id)?.due, false); // A jest już „zapisana"
  await core.setReminder(db, tA.id, aAM.id, "2026-10-04");
  check("zaległe przypomnienie przy rezygnacji nie jest „do kontaktu”", (await core.listCrmLeads(db, tA.id, { now: new Date("2026-10-05T08:00:00Z") })).find((i) => i.assignmentId === aAM.id)?.due, false);
  await crm.crmChangeStage(uA, aAM.id, { stage: "nowa" });
  const L2 = await lead({ name: "Zofia Szukana", phone: "602 333 444", email: "zofia@example.com", city: "Kraków" });
  const aA2 = await assign(L2.id, tA.id);
  await core.setReminder(db, tA.id, aA2.id, "2026-10-05");
  const now5 = new Date("2026-10-05T08:00:00Z");
  const items = await core.listCrmLeads(db, tA.id, { now: now5 });
  check("do kontaktu dziś: dzisiejsze (Zofia) i zaległe (Maria, wróciła na „nową”)", core.filterCrmList(items, { due: true }).map((i) => i.name), ["Zofia Szukana", "Maria Bez Zgody"]);
  check("jutrzejsze przypomnienie jeszcze nie jest due", core.isDue(new Date("2026-10-06T12:00:00Z"), "nowa", now5), false);
  check("filtr etapu", core.filterCrmList(items, { stage: "zapisana" }).map((i) => i.name), ["Gabriela Nowak"]);
  check("wyszukiwarka: imię, telefon (cyfry), miasto", [core.filterCrmList(items, { q: "zofia" }).length, core.filterCrmList(items, { q: "602 333" }).length, core.filterCrmList(items, { q: "kraków" }).length, core.filterCrmList(items, { q: "nie ma takiej" }).length], [1, 1, 1, 0]);
  check("reminderInstant: zła data = null", [core.reminderInstant("2026-02-31"), core.reminderInstant("jutro")], [null, null]);

  // ===== 8. RODO + ADMIN =====
  const adminLog = await core.adminMessageLog(db, L.id);
  check("admin widzi korespondencję obu trenerek tego leada", [...new Set(adminLog.map((m) => m.trainerId))].sort(), [tA.id, tB.id].sort());
  check("dziennik admina nie niesie pól rozliczeniowych", Object.keys(adminLog[0]).some((k) => /amount|billing|rate/i.test(k)), false);
  await db.update(schema.leads).set({ anonymizedAt: new Date(), phone: "[zanonimizowano]", email: "zanonimizowano-1@rodo.local" }).where(eq(schema.leads.id, L.id));
  const anonMail = await crm.crmSendEmail(uA, aAL.id, "a", "b");
  const anonSms = await crm.crmSendSms(uA, aAL.id, "a");
  check("zanonimizowany lead: e-mail i SMS = 409", [anonMail.ok === false && anonMail.status, anonSms.ok === false && anonSms.status], [409, 409]);
  const queuedBefore = (await db.select().from(schema.emailQueue).where(and(eq(schema.emailQueue.leadId, L.id), eq(schema.emailQueue.kind, "trenerka_crm")))).length;
  await core.purgeCrmForLead(db, L.id);
  check("RODO: przed purge w kolejce leżały maile trenerek do tego leada", queuedBefore > 0, true);
  check("RODO: po purge zero maili trenerek (trenerka_crm) tego leada w email_queue", (await db.select().from(schema.emailQueue).where(and(eq(schema.emailQueue.leadId, L.id), eq(schema.emailQueue.kind, "trenerka_crm")))).length, 0);
  const left = {
    msgs: (await db.select().from(schema.crmMessages).where(eq(schema.crmMessages.assignmentId, aAL.id))).length + (await db.select().from(schema.crmMessages).where(eq(schema.crmMessages.assignmentId, aBL.id))).length,
    notes: (await db.select().from(schema.crmNotes).where(eq(schema.crmNotes.assignmentId, aAL.id))).length,
  };
  check("RODO: anonimizacja kasuje wiadomości i notatki trenerek o tym leadzie", left, { msgs: 0, notes: 0 });
  check("RODO: karta zanonimizowanego leada bez danych kontaktowych", [(await core.getCrmDetail(db, tA.id, aAL.id))?.lead.phone, (await core.getCrmDetail(db, tA.id, aAL.id))?.lead.email], [null, null]);

  // ===== 9. STRAŻ STRUKTURALNA =====
  const routeFiles = walk("src/app/api/panel/crm").filter((f) => f.endsWith("route.ts"));
  check("trasy CRM istnieją (7 plików)", routeFiles.length, 7);
  for (const f of routeFiles) {
    const src = readFileSync(f, "utf8");
    check(`trasa ma bramkę sesji trenerki: ${f.replace("src/app/api/panel/crm/", "")}`, /withTrainer\(|requireTrainer\(/.test(src), true);
    check(`trasa nie czyta trainerId z żądania: ${f.replace("src/app/api/panel/crm/", "")}`, /body\.trainerId|parsed\.data\.trainerId|searchParams/.test(src), false);
  }
  const pages = [
    "src/app/panel/(panel)/leady/page.tsx",
    "src/app/panel/(panel)/leady/[id]/page.tsx",
    "src/app/panel/(panel)/szablony/page.tsx",
  ];
  for (const f of pages) {
    const src = readFileSync(f, "utf8");
    const gate = src.indexOf("requireTrainerPage()");
    const firstData = Math.min(...["getDb()", "listCrmLeads(", "getCrmDetail("].map((m) => src.indexOf(m)).filter((i) => i >= 0));
    check(`strona woła bramkę PRZED zapytaniem o dane: ${f.split("(panel)/")[1]}`, gate >= 0 && gate < firstData, true);
  }
  const mobile = readFileSync("src/app/api/mobile/leady/[id]/crm/route.ts", "utf8");
  check("trasa mobilna CRM używa warstwy mobilnej i bramki onboardingu", /requireTrainerMobile\(req\)/.test(mobile) && /isActive/.test(mobile), true);
  check("getSessionUser nietknięty (bez Bearer)", /authorization/i.test(readFileSync("src/lib/auth.ts", "utf8")), false);
  const coreSrc = readFileSync("src/lib/crm-core.ts", "utf8");
  check("rdzeń CRM nie czyta leads.status / notes / utm", /schema\.leads\.(status|notes|utm\w*|source)|lead\.(status|notes|utm\w*)|r\.lead\.(status|notes|utm)/.test(coreSrc), false);
  check("rdzeń CRM nie zapisuje statusu przydziału (idzie przez applyStatus)", /set\(\{[^}]*\bstatus\b/.test(coreSrc.replace(/status: (m|s)/g, "")), false);
  check("brak e-mailowej wysyłki hurtowej: żadna trasa CRM nie przyjmuje listy odbiorców", walk("src/app/api/panel/crm").some((f) => /recipients|assignmentIds|\.map\(.*send/.test(readFileSync(f, "utf8"))), false);
  for (const f of [...walk("src/components/panel/crm"), ...pages, "src/lib/crm-core.ts"]) {
    check(`brak „0 zł" w treściach CRM: ${f.split("/").pop()}`, /(^|[^\d])0 zł/.test(readFileSync(f, "utf8")), false);
  }

  console.log(failed === 0 ? "\nWSZYSTKO OK" : `\nNIEPOWODZENIA: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
