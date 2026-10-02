/**
 * RDZEŃ CRM TRENERKI — bez `server-only` i bez singletona bazy, żeby dało się go przetestować
 * na PGlite (`npm run test:crm`). W aplikacji wołaj funkcje z `@/lib/crm`.
 *
 * 🔴 ZASADA NACZELNA: wszystko jest kluczowane PRZYDZIAŁEM (lead × trenerka) i KAŻDA funkcja
 * zaczyna od `getOwnedAssignment(db, trainerId, assignmentId)`, które łączy po `trainer_id`
 * z sesji. Cudzy przydział = `null` = 404, identycznie jak przydział nieistniejący, więc
 * odpowiedź nie zdradza, że dany numer istnieje u kogoś innego. Z wiersza leada czytamy
 * wyłącznie pola wskazane w `LeadView` — nigdy `leads.status` (zdradziłby, że INNA trenerka
 * zamknęła zapis), `leads.notes` ani pól UTM (to wewnętrzne dane UB).
 *
 * ETAP vs STATUS (rozliczenia): jedynym źródłem prawdy o etapie i o naliczeniu jest
 * `lead_assignments.status`. CRM dokłada tylko podetap w obrębie „skontaktowany"
 * (`crm_substage`). Etap pokazywany w CRM jest WYLICZANY (`crmStageOf`), więc nie może się
 * rozjechać ze statusem zmienionym z telefonu albo przez admina. Przejście na „zapisana"
 * idzie WYŁĄCZNIE przez wstrzyknięte `applyStatus` = wspólna funkcja naliczająca.
 */
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/admin-audit-core";
import { greetingName } from "@/lib/template";
import { normalizePlPhone, smsLength, SMS_MAX_SEGMENTS } from "@/lib/sms/phone";
import type { SmsProvider } from "@/lib/sms/types";

// ===== ETAPY (czyste, współdzielone z komponentami klienckimi: `@/lib/crm-stages`) =====

import { CRM_STAGE_TO_STATUS, CRM_STAGE_LABELS, crmStageOf, renderCrmTemplate, type AssignmentStatus, type CrmStage } from "@/lib/crm-stages";
export * from "@/lib/crm-stages";

// ===== LIMITY =====

export const EMAIL_DAILY_LIMIT = 50;
export const SMS_DAILY_LIMIT = 30;
export const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_SUBJECT = 200;
export const MAX_EMAIL_BODY = 5000;
export const MAX_NOTE = 4000;

// ===== WYNIKI =====

export type Fail = { ok: false; status: number; error: string };
export type Res<T> = ({ ok: true } & T) | Fail;
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });
const NOT_FOUND = fail(404, "Nie znaleziono.");

// ===== DOSTĘP DO PRZYDZIAŁU (jedyna brama) =====

/** Pola leada, które trenerka widzi. Reszta wiersza `leads` NIGDY nie wychodzi z tej warstwy. */
export type LeadView = {
  name: string;
  phone: string | null;
  email: string | null;
  voivodeship: string;
  city: string | null;
  category: string;
  employmentStatus: string;
  preferredDate: string | null;
  message: string | null;
  courseTitle: string | null;
  /** Zgoda na telefon/SMS (`contactConsentAt`). Bez niej SMS jest zablokowany. */
  phoneConsent: boolean;
  anonymized: boolean;
};

export type Owned = {
  assignment: typeof schema.leadAssignments.$inferSelect;
  trainer: typeof schema.trainers.$inferSelect;
  leadId: number;
  lead: LeadView;
};

export async function getOwnedAssignment(
  db: AnyDb,
  trainerId: number,
  assignmentId: number
): Promise<Owned | null> {
  if (!Number.isInteger(assignmentId) || !Number.isInteger(trainerId)) return null;
  const rows = await db
    .select({
      assignment: schema.leadAssignments,
      trainer: schema.trainers,
      lead: schema.leads,
      courseTitle: schema.courses.title,
    })
    .from(schema.leadAssignments)
    .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .leftJoin(schema.courses, eq(schema.leads.courseId, schema.courses.id))
    .where(and(eq(schema.leadAssignments.id, assignmentId), eq(schema.leadAssignments.trainerId, trainerId)))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  const anonymized = Boolean(r.lead.anonymizedAt);
  return {
    assignment: r.assignment,
    trainer: r.trainer,
    leadId: r.lead.id,
    lead: {
      name: r.lead.name,
      phone: anonymized ? null : r.lead.phone,
      email: anonymized ? null : r.lead.email,
      voivodeship: r.lead.voivodeship,
      city: r.lead.city,
      category: r.lead.category,
      employmentStatus: r.lead.employmentStatus,
      preferredDate: r.lead.preferredDate,
      message: anonymized ? null : r.lead.message,
      courseTitle: r.courseTitle ?? null,
      phoneConsent: Boolean(r.lead.contactConsentAt),
      anonymized,
    },
  };
}

/** Konto po samodzielnej rejestracji, przed aktywacją, nie dotyka danych kursantek (jak w całym panelu). */
const GATE = fail(403, "Konto czeka na aktywację. Skontaktujemy się telefonicznie przed pierwszym zgłoszeniem.");

// ===== DATY (strefa Europe/Warsaw) =====

const ymdFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" });
/** `YYYY-MM-DD` w Warszawie. */
export function ymdWarsaw(d: Date): string {
  return ymdFmt.format(d);
}

/** Przypomnienie to DATA (bez godziny): zapisujemy ją jako 12:00 UTC, czyli ten sam dzień w Warszawie. */
export function reminderInstant(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== ymd ? null : d;
}

/** Czy przypomnienie wypada dziś albo jest zaległe (i przydział jest jeszcze „żywy"). */
export function isDue(
  nextContactAt: Date | null,
  stage: CrmStage,
  now: Date
): boolean {
  if (!nextContactAt) return false;
  if (stage === "zapisana" || stage === "rezygnacja") return false;
  return ymdWarsaw(nextContactAt) <= ymdWarsaw(now);
}

// ===== LISTA =====

export type CrmListItem = {
  assignmentId: number;
  name: string;
  phone: string | null;
  email: string | null;
  category: string;
  city: string | null;
  voivodeship: string;
  stage: CrmStage;
  nextContactAt: string | null;
  due: boolean;
  anonymized: boolean;
  phoneConsent: boolean;
  createdAt: string;
};

export async function listCrmLeads(
  db: AnyDb,
  trainerId: number,
  opts: { now?: Date } = {}
): Promise<CrmListItem[]> {
  const now = opts.now ?? new Date();
  const rows = await db
    .select({ assignment: schema.leadAssignments, lead: schema.leads })
    .from(schema.leadAssignments)
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .where(eq(schema.leadAssignments.trainerId, trainerId))
    .orderBy(desc(schema.leadAssignments.createdAt));
  return rows.map(({ assignment, lead }) => {
    const stage = crmStageOf(assignment.status, assignment.crmSubstage);
    const anonymized = Boolean(lead.anonymizedAt);
    return {
      assignmentId: assignment.id,
      name: lead.name,
      phone: anonymized ? null : lead.phone,
      email: anonymized ? null : lead.email,
      category: lead.category,
      city: lead.city,
      voivodeship: lead.voivodeship,
      stage,
      nextContactAt: assignment.nextContactAt ? assignment.nextContactAt.toISOString() : null,
      due: isDue(assignment.nextContactAt, stage, now),
      anonymized,
      phoneConsent: Boolean(lead.contactConsentAt),
      createdAt: assignment.createdAt.toISOString(),
    };
  });
}

/** Filtrowanie listy (etap, wyszukiwarka, „do kontaktu dziś") — czysta funkcja, testowalna. */
export function filterCrmList(
  items: CrmListItem[],
  f: { stage?: CrmStage | null; q?: string | null; due?: boolean }
): CrmListItem[] {
  const q = (f.q ?? "").trim().toLocaleLowerCase("pl");
  const qDigits = q.replace(/\D/g, "");
  return items.filter((i) => {
    if (f.stage && i.stage !== f.stage) return false;
    if (f.due && !i.due) return false;
    if (q) {
      const hay = [i.name, i.email ?? "", i.category, i.city ?? ""].join(" ").toLocaleLowerCase("pl");
      const phoneHit = qDigits.length >= 3 && (i.phone ?? "").replace(/\D/g, "").includes(qDigits);
      if (!hay.includes(q) && !phoneHit) return false;
    }
    return true;
  });
}

// ===== OŚ CZASU =====

export type TimelineItem = {
  key: string;
  at: string;
  type: "notatka" | "etap" | "przypomnienie" | "email" | "sms";
  text: string;
  /** Tylko e-mail/SMS. */
  message?: {
    channel: "email" | "sms";
    to: string;
    subject: string | null;
    status: string;
    error: string | null;
    segments: number | null;
  };
};

export async function loadTimeline(db: AnyDb, trainerId: number, assignmentId: number): Promise<TimelineItem[]> {
  const [notes, events, messages] = await Promise.all([
    db
      .select()
      .from(schema.crmNotes)
      .where(and(eq(schema.crmNotes.assignmentId, assignmentId), eq(schema.crmNotes.trainerId, trainerId))),
    db
      .select()
      .from(schema.crmEvents)
      .where(and(eq(schema.crmEvents.assignmentId, assignmentId), eq(schema.crmEvents.trainerId, trainerId))),
    db
      .select({ m: schema.crmMessages, queueStatus: schema.emailQueue.status })
      .from(schema.crmMessages)
      .leftJoin(schema.emailQueue, eq(schema.crmMessages.emailQueueId, schema.emailQueue.id))
      .where(and(eq(schema.crmMessages.assignmentId, assignmentId), eq(schema.crmMessages.trainerId, trainerId))),
  ]);
  const items: TimelineItem[] = [
    ...notes.map((n): TimelineItem => ({ key: `n${n.id}`, at: n.createdAt.toISOString(), type: "notatka", text: n.body })),
    ...events.map((e): TimelineItem => ({
      key: `e${e.id}`,
      at: e.createdAt.toISOString(),
      type: e.kind === "przypomnienie" ? "przypomnienie" : "etap",
      text: e.summary,
    })),
    ...messages.map(({ m, queueStatus }): TimelineItem => ({
      key: `m${m.id}`,
      at: m.createdAt.toISOString(),
      type: m.channel === "sms" ? "sms" : "email",
      text: m.body,
      message: {
        channel: m.channel === "sms" ? "sms" : "email",
        to: m.toAddress,
        subject: m.subject,
        // Status e-maila czytamy NA ŻYWO z kolejki: mail, który czekał na SMTP, po wysyłce z crona
        // ma być pokazany jako wysłany, a nie wiecznie „w kolejce".
        status: m.channel === "email" && queueStatus ? queueStatus : m.status,
        error: m.error,
        segments: m.segments,
      },
    })),
  ];
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.key < b.key ? 1 : -1));
}

export type CrmDetail = {
  assignmentId: number;
  lead: LeadView;
  stage: CrmStage;
  status: AssignmentStatus;
  rejectionReason: string | null;
  nextContactAt: string | null; // YYYY-MM-DD
  createdAt: string;
  trainerName: string;
  timeline: TimelineItem[];
};

export async function getCrmDetail(db: AnyDb, trainerId: number, assignmentId: number): Promise<CrmDetail | null> {
  const owned = await getOwnedAssignment(db, trainerId, assignmentId);
  if (!owned) return null;
  const { assignment } = owned;
  return {
    assignmentId,
    lead: owned.lead,
    stage: crmStageOf(assignment.status, assignment.crmSubstage),
    status: assignment.status,
    rejectionReason: assignment.rejectionReason,
    nextContactAt: assignment.nextContactAt ? ymdWarsaw(assignment.nextContactAt) : null,
    createdAt: assignment.createdAt.toISOString(),
    trainerName: owned.trainer.name,
    timeline: await loadTimeline(db, trainerId, assignmentId),
  };
}

// ===== ZMIANA ETAPU =====

export type ApplyStatus = (input: {
  status: AssignmentStatus;
  rejectionReason?: string;
}) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;

/**
 * Zmiana etapu. Gdy etap wymaga INNEGO statusu przydziału niż obecny, wołamy `applyStatus`
 * (= `updateTrainerAssignmentStatus`, ta sama funkcja co w panelu i w telefonie), więc naliczenie
 * i maile działają identycznie. Przejście wewnątrz „skontaktowany" (kontakt → rozmowa → wniosek)
 * NIE dotyka statusu ani rozliczeń. Zapisana jest jednokierunkowa: wyjście z niej odbijałoby
 * się na już naliczonej należności, więc koryguje ją biuro.
 */
export async function changeStage(
  db: AnyDb,
  trainerId: number,
  assignmentId: number,
  input: { stage: CrmStage; rejectionReason?: string },
  deps: { applyStatus: ApplyStatus }
): Promise<Res<{ stage: CrmStage }>> {
  const owned = await getOwnedAssignment(db, trainerId, assignmentId);
  if (!owned) return NOT_FOUND;
  if (!owned.trainer.isActive) return GATE;

  const { assignment } = owned;
  const from = crmStageOf(assignment.status, assignment.crmSubstage);
  const to = input.stage;
  if (from === to) return { ok: true, stage: to };

  if (assignment.status === "zapisana") {
    return fail(409, "Zapis jest już naliczony. Jeśli to pomyłka, napisz do biura Uniwersytetu Beauty.");
  }

  const reason = input.rejectionReason?.trim();
  if (to === "rezygnacja" && !reason) return fail(400, "Podaj powód rezygnacji.");

  const targetStatus = CRM_STAGE_TO_STATUS[to];
  if (targetStatus !== assignment.status) {
    const res = await deps.applyStatus({ status: targetStatus, rejectionReason: reason });
    if (!res.ok) return fail(res.status, res.error);
  }

  await db
    .update(schema.leadAssignments)
    .set({ crmSubstage: targetStatus === "skontaktowany" ? to : null })
    .where(and(eq(schema.leadAssignments.id, assignmentId), eq(schema.leadAssignments.trainerId, trainerId)));

  await db.insert(schema.crmEvents).values({
    assignmentId,
    trainerId,
    kind: "etap",
    summary: `Etap: ${CRM_STAGE_LABELS[from]} → ${CRM_STAGE_LABELS[to]}${to === "rezygnacja" && reason ? ` (${reason})` : ""}`,
  });
  return { ok: true, stage: to };
}

// ===== NOTATKI I PRZYPOMNIENIA =====

export async function addNote(
  db: AnyDb,
  trainerId: number,
  assignmentId: number,
  body: string
): Promise<Res<{ noteId: number }>> {
  const owned = await getOwnedAssignment(db, trainerId, assignmentId);
  if (!owned) return NOT_FOUND;
  if (!owned.trainer.isActive) return GATE;
  const text = body.trim();
  if (!text) return fail(400, "Notatka jest pusta.");
  if (text.length > MAX_NOTE) return fail(400, `Notatka jest za długa (max ${MAX_NOTE} znaków).`);
  const [row] = await db
    .insert(schema.crmNotes)
    .values({ assignmentId, trainerId, body: text })
    .returning({ id: schema.crmNotes.id });
  return { ok: true, noteId: row.id };
}

/** `ymd = null` kasuje przypomnienie. */
export async function setReminder(
  db: AnyDb,
  trainerId: number,
  assignmentId: number,
  ymd: string | null
): Promise<Res<{ nextContactAt: string | null }>> {
  const owned = await getOwnedAssignment(db, trainerId, assignmentId);
  if (!owned) return NOT_FOUND;
  if (!owned.trainer.isActive) return GATE;
  let instant: Date | null = null;
  if (ymd !== null) {
    instant = reminderInstant(ymd);
    if (!instant) return fail(400, "Nieprawidłowa data.");
  }
  await db
    .update(schema.leadAssignments)
    .set({ nextContactAt: instant })
    .where(and(eq(schema.leadAssignments.id, assignmentId), eq(schema.leadAssignments.trainerId, trainerId)));
  await db.insert(schema.crmEvents).values({
    assignmentId,
    trainerId,
    kind: "przypomnienie",
    summary: ymd ? `Następny kontakt: ${ymd}` : "Usunięto przypomnienie o kontakcie",
  });
  return { ok: true, nextContactAt: ymd };
}

// ===== SZABLONY =====

export function templateVars(lead: Pick<LeadView, "name" | "courseTitle" | "category">) {
  return { imie: greetingName(lead.name), kurs: lead.courseTitle ?? lead.category };
}

export type TemplateInput = { channel: "email" | "sms"; name: string; subject?: string | null; body: string };

function validateTemplate(i: TemplateInput): string | null {
  if (i.channel !== "email" && i.channel !== "sms") return "Nieprawidłowy kanał.";
  if (!i.name.trim() || i.name.length > 120) return "Nazwa szablonu: 1–120 znaków.";
  if (!i.body.trim()) return "Treść szablonu jest pusta.";
  if (i.body.length > MAX_EMAIL_BODY) return `Treść jest za długa (max ${MAX_EMAIL_BODY} znaków).`;
  if (i.channel === "email" && (i.subject ?? "").length > MAX_SUBJECT) return "Temat jest za długi.";
  return null;
}

export async function listTemplates(db: AnyDb, trainerId: number) {
  return db
    .select()
    .from(schema.crmTemplates)
    .where(eq(schema.crmTemplates.trainerId, trainerId))
    .orderBy(asc(schema.crmTemplates.name));
}

export async function createTemplate(db: AnyDb, trainerId: number, input: TemplateInput): Promise<Res<{ id: number }>> {
  const err = validateTemplate(input);
  if (err) return fail(400, err);
  const [row] = await db
    .insert(schema.crmTemplates)
    .values({
      trainerId,
      channel: input.channel,
      name: input.name.trim(),
      subject: input.channel === "email" ? (input.subject ?? "").trim() : null,
      body: input.body,
    })
    .returning({ id: schema.crmTemplates.id });
  return { ok: true, id: row.id };
}

export async function updateTemplate(
  db: AnyDb,
  trainerId: number,
  templateId: number,
  input: TemplateInput
): Promise<Res<{ id: number }>> {
  const err = validateTemplate(input);
  if (err) return fail(400, err);
  const rows = await db
    .update(schema.crmTemplates)
    .set({
      channel: input.channel,
      name: input.name.trim(),
      subject: input.channel === "email" ? (input.subject ?? "").trim() : null,
      body: input.body,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.crmTemplates.id, templateId), eq(schema.crmTemplates.trainerId, trainerId)))
    .returning({ id: schema.crmTemplates.id });
  return rows[0] ? { ok: true, id: rows[0].id } : NOT_FOUND;
}

export async function deleteTemplate(db: AnyDb, trainerId: number, templateId: number): Promise<Res<object>> {
  const rows = await db
    .delete(schema.crmTemplates)
    .where(and(eq(schema.crmTemplates.id, templateId), eq(schema.crmTemplates.trainerId, trainerId)))
    .returning({ id: schema.crmTemplates.id });
  return rows[0] ? { ok: true } : NOT_FOUND;
}

// ===== LIMIT DZIENNY =====

/**
 * Ile wiadomości danego kanału trenerka wysłała w ostatnich 24 h. Liczymy WIERSZE W BAZIE,
 * nie licznik w pamięci: przeżywa restart kontenera i da się go przetestować. Liczą się też
 * nieudane próby i dry-run, żeby tryb testowy zachowywał się jak produkcja.
 */
export async function countSentLast24h(
  db: AnyDb,
  trainerId: number,
  channel: "email" | "sms",
  now: Date
): Promise<number> {
  const since = new Date(now.getTime() - RATE_WINDOW_MS);
  const [r] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.crmMessages)
    .where(
      and(
        eq(schema.crmMessages.trainerId, trainerId),
        eq(schema.crmMessages.channel, channel),
        gte(schema.crmMessages.createdAt, since)
      )
    );
  return r?.c ?? 0;
}

export async function dailyUsage(db: AnyDb, trainerId: number, now = new Date()) {
  const [email, sms] = await Promise.all([
    countSentLast24h(db, trainerId, "email", now),
    countSentLast24h(db, trainerId, "sms", now),
  ]);
  return { email, emailLimit: EMAIL_DAILY_LIMIT, sms, smsLimit: SMS_DAILY_LIMIT };
}

// ===== E-MAIL 1:1 =====

export type EnqueueEmail = (m: {
  to: string;
  subject: string;
  body: string;
  fromName: string;
  replyTo: string;
  leadId: number;
}) => Promise<{ queueId?: number }>;

/**
 * 🔴 TODO(prawnik): NIE MA wysyłki hurtowej (jedna treść do wielu kursantek). Wiadomość 1:1 jako
 * odpowiedź na zgłoszenie kursantki ma inną podstawę prawną niż mailing: zgoda marketingowa
 * i art. 398 Prawa komunikacji elektronicznej wymagają potwierdzenia przez radcę (pytania
 * w `docs/prawne/pdf/PYTANIA-DO-PRAWNIKA.pdf`). Dopóki nie ma odpowiedzi — każda wysyłka
 * jest ręczna, do jednej osoby, z widoku jej karty.
 */
export async function sendCrmEmail(
  db: AnyDb,
  p: {
    trainerId: number;
    /** E-mail konta trenerki — trafia w Reply-To. */
    accountEmail: string;
    assignmentId: number;
    subject: string;
    body: string;
    now?: Date;
  },
  deps: { enqueue: EnqueueEmail }
): Promise<Res<{ messageId: number; status: string }>> {
  const now = p.now ?? new Date();
  const owned = await getOwnedAssignment(db, p.trainerId, p.assignmentId);
  if (!owned) return NOT_FOUND;
  if (!owned.trainer.isActive) return GATE;
  if (owned.lead.anonymized || !owned.lead.email) {
    return fail(409, "Zgłoszenie zostało zanonimizowane (RODO). Nie ma adresu, na który można napisać.");
  }

  const vars = templateVars(owned.lead);
  const subject = renderCrmTemplate(p.subject, vars).replace(/[\r\n]+/g, " ").trim();
  const bodyText = renderCrmTemplate(p.body, vars).trim();
  if (!subject) return fail(400, "Podaj temat wiadomości.");
  if (!bodyText) return fail(400, "Wiadomość jest pusta.");
  if (subject.length > MAX_SUBJECT) return fail(400, `Temat jest za długi (max ${MAX_SUBJECT} znaków).`);
  if (bodyText.length > MAX_EMAIL_BODY) return fail(400, `Wiadomość jest za długa (max ${MAX_EMAIL_BODY} znaków).`);

  if ((await countSentLast24h(db, p.trainerId, "email", now)) >= EMAIL_DAILY_LIMIT) {
    return fail(429, `Dzienny limit wiadomości e-mail (${EMAIL_DAILY_LIMIT}) został wykorzystany. Spróbuj jutro.`);
  }

  const fullBody = [
    bodyText,
    "",
    "—",
    `${owned.trainer.name}`,
    "Wiadomość wysłana przez Uniwersytet Beauty w imieniu akademii. Aby odpisać akademii, odpowiedz na tego maila.",
  ].join("\n");

  const { queueId } = await deps.enqueue({
    to: owned.lead.email,
    subject,
    body: fullBody,
    fromName: `${owned.trainer.name} przez Uniwersytet Beauty`,
    replyTo: p.accountEmail,
    leadId: owned.leadId,
  });

  let status = "w_kolejce";
  if (queueId) {
    const [q] = await db
      .select({ status: schema.emailQueue.status })
      .from(schema.emailQueue)
      .where(eq(schema.emailQueue.id, queueId))
      .limit(1);
    if (q) status = q.status;
  }
  const [m] = await db
    .insert(schema.crmMessages)
    .values({
      assignmentId: p.assignmentId,
      trainerId: p.trainerId,
      channel: "email",
      toAddress: owned.lead.email,
      subject,
      body: bodyText,
      status,
      provider: "smtp",
      emailQueueId: queueId ?? null,
      createdAt: now,
    })
    .returning({ id: schema.crmMessages.id });
  return { ok: true, messageId: m.id, status };
}

// ===== SMS 1:1 =====

export async function sendCrmSms(
  db: AnyDb,
  p: { trainerId: number; assignmentId: number; text: string; now?: Date },
  deps: { provider: SmsProvider }
): Promise<Res<{ messageId: number; status: string; provider: string }>> {
  const now = p.now ?? new Date();
  const owned = await getOwnedAssignment(db, p.trainerId, p.assignmentId);
  if (!owned) return NOT_FOUND;
  if (!owned.trainer.isActive) return GATE;
  if (owned.lead.anonymized || !owned.lead.phone) {
    return fail(409, "Zgłoszenie zostało zanonimizowane (RODO). Nie ma numeru, na który można napisać.");
  }
  // Art. 398 Prawa komunikacji elektronicznej: SMS/telefon wymaga odrębnej, uprzedniej zgody.
  // Zgłoszenia sprzed jej rozdzielenia (`contactConsentAt = NULL`) nie mają jej wcale.
  if (!owned.lead.phoneConsent) {
    return fail(403, "Ta kursantka nie wyraziła zgody na kontakt telefoniczny i SMS. Napisz do niej e-mailem.");
  }
  const phone = normalizePlPhone(owned.lead.phone);
  if (!phone.ok) return fail(422, phone.error);

  const text = renderCrmTemplate(p.text, templateVars(owned.lead)).trim();
  if (!text) return fail(400, "Wiadomość jest pusta.");
  const len = smsLength(text);
  if (len.segments > SMS_MAX_SEGMENTS) {
    return fail(400, `SMS jest za długi (${len.segments} części, max ${SMS_MAX_SEGMENTS}).`);
  }
  if ((await countSentLast24h(db, p.trainerId, "sms", now)) >= SMS_DAILY_LIMIT) {
    return fail(429, `Dzienny limit SMS-ów (${SMS_DAILY_LIMIT}) został wykorzystany. Spróbuj jutro.`);
  }

  let result;
  try {
    result = await deps.provider.send(phone.e164, text);
  } catch (err) {
    result = { id: null, status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
  }
  const status = result.status === "sent" ? "wyslany" : result.status === "dry-run" ? "dry-run" : "blad";
  const [m] = await db
    .insert(schema.crmMessages)
    .values({
      assignmentId: p.assignmentId,
      trainerId: p.trainerId,
      channel: "sms",
      toAddress: phone.e164,
      body: text,
      status,
      provider: deps.provider.name,
      providerId: result.id,
      error: result.error ?? null,
      segments: len.segments,
      createdAt: now,
    })
    .returning({ id: schema.crmMessages.id });
  if (status === "blad") return fail(502, `Nie udało się wysłać SMS-a: ${result.error ?? "błąd bramki"}.`);
  return { ok: true, messageId: m.id, status, provider: deps.provider.name };
}

// ===== RODO =====

/**
 * Anonimizacja leada kasuje też korespondencję i notatki trenerek o tej osobie:
 * treść wiadomości i numer/adres w `crm_messages` to dane osobowe, które anonimizacja
 * wiersza `leads` sama z siebie by nie ruszyła.
 */
export async function purgeCrmForLead(db: AnyDb, leadId: number): Promise<void> {
  const ids = (
    await db.select({ id: schema.leadAssignments.id }).from(schema.leadAssignments).where(eq(schema.leadAssignments.leadId, leadId))
  ).map((r) => r.id);
  if (ids.length === 0) return;
  // Każdy e-mail CRM leży też w `email_queue` (prawdziwy adres + treść trenerki). Przy braku SMTP
  // czeka tam i wyszedłby przy najbliższym flushu mimo anonimizacji, więc kasujemy go razem z wpisem w CRM.
  const queueIds = (
    await db
      .select({ q: schema.crmMessages.emailQueueId })
      .from(schema.crmMessages)
      .where(inArray(schema.crmMessages.assignmentId, ids))
  )
    .map((r) => r.q)
    .filter((q): q is number => q !== null);
  await db.delete(schema.crmMessages).where(inArray(schema.crmMessages.assignmentId, ids));
  if (queueIds.length > 0) await db.delete(schema.emailQueue).where(inArray(schema.emailQueue.id, queueIds));
  await db
    .delete(schema.emailQueue)
    .where(and(eq(schema.emailQueue.leadId, leadId), eq(schema.emailQueue.kind, "trenerka_crm")));
  await db.delete(schema.crmNotes).where(inArray(schema.crmNotes.assignmentId, ids));
  await db.delete(schema.crmEvents).where(inArray(schema.crmEvents.assignmentId, ids));
  await db
    .update(schema.leadAssignments)
    .set({ nextContactAt: null })
    .where(inArray(schema.leadAssignments.id, ids));
}

// ===== WIDOK ADMINA (tylko odczyt) =====

/** Dziennik wiadomości trenerek dla jednego leada, pogrupowany po przydziale. Tylko dla admina. */
export async function adminMessageLog(db: AnyDb, leadId: number) {
  return db
    .select({
      id: schema.crmMessages.id,
      assignmentId: schema.crmMessages.assignmentId,
      trainerId: schema.crmMessages.trainerId,
      channel: schema.crmMessages.channel,
      toAddress: schema.crmMessages.toAddress,
      subject: schema.crmMessages.subject,
      body: schema.crmMessages.body,
      status: schema.crmMessages.status,
      provider: schema.crmMessages.provider,
      error: schema.crmMessages.error,
      createdAt: schema.crmMessages.createdAt,
    })
    .from(schema.crmMessages)
    .innerJoin(schema.leadAssignments, eq(schema.crmMessages.assignmentId, schema.leadAssignments.id))
    .where(eq(schema.leadAssignments.leadId, leadId))
    .orderBy(desc(schema.crmMessages.createdAt));
}
