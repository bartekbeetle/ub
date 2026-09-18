import "server-only";
import { and, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Rodzaje maili wychodzących. Wartość trafia do `email_queue.kind` i jest kluczem
 * idempotencji — patrz `alreadyQueued`.
 */
export const EMAIL_KIND = {
  /** Do trenerki: dostajesz nowy lead. */
  TRENERKA_LEAD: "trenerka_lead",
  /** Do kursantki: potwierdzamy przyjęcie zgłoszenia. */
  KURSANTKA_POTWIERDZENIE: "kursantka_potwierdzenie",
  /** Do kursantki: akademia potwierdziła zapis. */
  KURSANTKA_ZAPIS: "kursantka_zapis",
  /** Do nas (notifyEmail): kursantka zapisana, jest za co fakturować. */
  WEWNETRZNE_ZAPIS: "wewnetrzne_zapis",
} as const;

export type EmailKind = (typeof EMAIL_KIND)[keyof typeof EMAIL_KIND];

/** Po tylu nieudanych próbach worker przestaje ponawiać i zostawia maila jako „blad". */
export const MAX_EMAIL_ATTEMPTS = 5;

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Czy dla tego leada ten rodzaj maila już poszedł (albo czeka w kolejce).
 *
 * Powód istnienia: status „zapisana" da się ustawić z TRZECH niezależnych miejsc
 * (panel trenerki, admin→przydział, admin→lead). Bez tej blokady kursantka dostawałaby
 * gratulacje tyle razy, ile osób kliknie — a przy rozliczeniu 500 zł klikają obie strony.
 * Maile ze statusem „blad" nie blokują: skoro nie wyszły, wolno spróbować ponownie.
 */
async function alreadyQueued(leadId: number, kind: EmailKind): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.emailQueue.id })
    .from(schema.emailQueue)
    .where(
      and(
        eq(schema.emailQueue.leadId, leadId),
        eq(schema.emailQueue.kind, kind),
        inArray(schema.emailQueue.status, ["w_kolejce", "wyslany"])
      )
    )
    .limit(1);
  return rows.length > 0;
}

async function deliver(row: {
  id: number;
  toEmail: string;
  subject: string;
  body: string;
  attempts: number;
}): Promise<{ sent: boolean }> {
  const db = await getDb();
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: row.toEmail,
      subject: row.subject,
      text: row.body,
    });
    await db
      .update(schema.emailQueue)
      .set({ status: "wyslany", sentAt: new Date(), attempts: row.attempts + 1, error: null })
      .where(eq(schema.emailQueue.id, row.id));
    return { sent: true };
  } catch (err) {
    const attempts = row.attempts + 1;
    await db
      .update(schema.emailQueue)
      .set({
        // Dopóki nie wyczerpaliśmy prób, zostawiamy „w_kolejce" — worker spróbuje ponownie.
        status: attempts >= MAX_EMAIL_ATTEMPTS ? "blad" : "w_kolejce",
        attempts,
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(schema.emailQueue.id, row.id));
    console.error(`[email] Błąd wysyłki (próba ${attempts}):`, err);
    return { sent: false };
  }
}

/**
 * Wysyła email albo — gdy brak SMTP w env — zostawia go w kolejce (email_queue).
 * Aplikacja NIGDY nie wywala się przez brak konfiguracji mailowej.
 *
 * Gdy podasz `kind` + `leadId`, wysyłka jest idempotentna: drugie wywołanie dla tej samej
 * pary nic nie robi i zwraca `skipped: true`.
 */
export async function sendOrQueueEmail(params: {
  to: string;
  subject: string;
  body: string;
  leadId?: number | null;
  kind?: EmailKind;
}): Promise<{ sent: boolean; skipped?: boolean }> {
  const db = await getDb();
  const kind = params.kind ?? "inne";

  if (!params.to) {
    console.warn(`[email] Pominięto maila (${kind}) — pusty adres odbiorcy.`);
    return { sent: false, skipped: true };
  }

  if (params.kind && params.leadId && (await alreadyQueued(params.leadId, params.kind))) {
    console.log(`[email] Pominięto duplikat ${kind} dla leada ${params.leadId}.`);
    return { sent: false, skipped: true };
  }

  const [queued] = await db
    .insert(schema.emailQueue)
    .values({
      toEmail: params.to,
      subject: params.subject,
      body: params.body,
      leadId: params.leadId ?? null,
      kind,
    })
    .returning();

  if (!smtpConfigured()) {
    console.log(`[email] SMTP nieskonfigurowane — mail do ${params.to} w kolejce (id=${queued.id})`);
    return { sent: false };
  }

  return deliver({
    id: queued.id,
    toEmail: queued.toEmail,
    subject: queued.subject,
    body: queued.body,
    attempts: queued.attempts,
  });
}

/**
 * Domyślne okno wieku maila. Kolejka rośnie od lipca 2026, bo SMTP nigdy nie był ustawiony —
 * w środku leżą powiadomienia o leadach sprzed miesięcy. Wysłanie ich w dniu włączenia SMTP
 * byłoby gorsze niż niewysłanie niczego: trenerka dostaje „pilny lead" na kursantkę, która
 * dawno kupiła gdzie indziej, i traci zaufanie do kanału przy pierwszym kontakcie.
 * Stare maile zostają w bazie jako historia — po prostu ich nie wysyłamy.
 */
export const DEFAULT_MAX_EMAIL_AGE_DAYS = 7;

/**
 * Opróżnia kolejkę: bierze maile czekające i te po nieudanych próbach, próbuje wysłać.
 * Wołane przez `/api/cron/email-queue`.
 *
 * Bez tego workera samo ustawienie SMTP nic nie daje — zaległe maile zostają w bazie
 * na zawsze, bo `sendOrQueueEmail` próbuje wysłać tylko w momencie zdarzenia.
 *
 * `maxAgeDays: null` wyłącza filtr wieku — świadoma decyzja operatora, nie domyślne zachowanie.
 */
export async function flushEmailQueue(
  limit = 50,
  maxAgeDays: number | null = DEFAULT_MAX_EMAIL_AGE_DAYS
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: boolean;
  skippedTooOld: number;
}> {
  if (!smtpConfigured()) {
    return { processed: 0, sent: 0, failed: 0, skipped: true, skippedTooOld: 0 };
  }

  const db = await getDb();
  const readyFilter = and(
    or(
      eq(schema.emailQueue.status, "w_kolejce"),
      and(eq(schema.emailQueue.status, "blad"), lt(schema.emailQueue.attempts, MAX_EMAIL_ATTEMPTS))
    ),
    lt(schema.emailQueue.attempts, MAX_EMAIL_ATTEMPTS)
  );

  let skippedTooOld = 0;
  let ageFilter = readyFilter;
  if (maxAgeDays !== null) {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const [tooOld] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.emailQueue)
      .where(and(readyFilter, lt(schema.emailQueue.createdAt, cutoff)));
    skippedTooOld = tooOld?.c ?? 0;
    ageFilter = and(readyFilter, gte(schema.emailQueue.createdAt, cutoff))!;
  }

  const pending = await db.select().from(schema.emailQueue).where(ageFilter).limit(limit);

  let sent = 0;
  let failed = 0;
  for (const row of pending) {
    const res = await deliver(row);
    if (res.sent) sent++;
    else failed++;
  }

  return { processed: pending.length, sent, failed, skipped: false, skippedTooOld };
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
