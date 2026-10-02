/**
 * Rdzeń przypomnienia „dokończ aplikację" — bez `server-only` i bez singletona bazy,
 * żeby dało się go przetestować na PGlite (`npm run test:porzucone`).
 * W aplikacji wołaj `runAbandonedMailer` z `@/lib/abandoned-mailer`.
 *
 * PODSTAWA PRAWNA (sprawdzona 02.10.2026 w UI kroku 1 formularza, `src/components/Quiz.tsx`):
 * wymagany checkbox „Zgadzam się na kontakt w sprawie mojej aplikacji — e-mailem, telefonicznie
 * lub SMS-em — ... Obejmuje to przypomnienie o dokończeniu aplikacji, jeśli jej nie złożę."
 * Zgoda zapisuje się w `quiz_sessions.contact_consent_at`, dlatego KAŻDA wysyłka jest filtrowana
 * po tej kolumnie, a nie po samym istnieniu adresu (endpoint postępu zapisuje e-mail także
 * wtedy, gdy ktoś wywoła go bez zgody).
 */
import { randomBytes } from "crypto";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/admin-audit-core";
import { greetingName, renderTemplate } from "@/lib/template";

/** Najwcześniej po 2 h od ostatniej aktywności — osoba mogła po prostu wyjść na chwilę. */
export const MIN_AGE_HOURS = 2;
/** Najpóźniej 7 dni — później „przypomnienie" jest już cold mailem. */
export const MAX_AGE_DAYS = 7;
/** Jak długo link „dokończ" działa od wysłania przypomnienia. */
export const RESUME_TOKEN_TTL_DAYS = 14;
/** Górny limit na jedno uruchomienie crona (ochrona przed zalewem po awarii). */
export const MAX_PER_RUN = 50;

export const REMINDER_SUBJECT = "Twoja aplikacja czeka na dokończenie";

/**
 * Kill-switch. Podstawa prawna istnieje (zgoda na kroku 1), więc domyślnie WŁĄCZONE;
 * `ABANDONED_MAILER_ENABLED=0|false|off|no` wyłącza całkowicie (nic nie trafia do kolejki).
 */
export function isMailerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.ABANDONED_MAILER_ENABLED ?? "").trim().toLowerCase();
  return !["0", "false", "off", "no"].includes(v);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Candidate = {
  sessionId: number;
  email: string;
  name: string | null;
  category: string | null;
};

/**
 * Sesje, do których wolno wysłać przypomnienie. Jedna na adres (najświeższa).
 * Wszystkie reguły są w SQL / jednym miejscu, żeby test pokrywał dokładnie to, co leci na produkcji.
 */
export async function findCandidates(db: AnyDb, now: Date, limit = MAX_PER_RUN): Promise<Candidate[]> {
  const s = schema.quizSessions;
  const newest = new Date(now.getTime() - MIN_AGE_HOURS * 3600_000);
  const oldest = new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000);

  const rows = await db
    .select({ id: s.id, email: s.email, name: s.name, category: s.category, updatedAt: s.updatedAt })
    .from(s)
    .where(
      and(
        eq(s.completed, false),
        isNull(s.leadId),
        isNotNull(s.contactConsentAt),
        isNotNull(s.email),
        lte(s.updatedAt, newest),
        gte(s.updatedAt, oldest),
        // Adres, który ma już dokończoną sesję albo lead (z dowolnej sesji / zgłoszenia).
        sql`not exists (select 1 from quiz_sessions q2 where lower(trim(q2.email)) = lower(trim(${s.email})) and (q2.completed = true or q2.lead_id is not null))`,
        sql`not exists (select 1 from leads l where lower(trim(l.email)) = lower(trim(${s.email})))`,
        // Max jedno przypomnienie na adres, kiedykolwiek.
        sql`not exists (select 1 from abandoned_reminders r where r.email = lower(trim(${s.email})))`,
        // Wypisani z listy (to samo źródło prawdy co mailing).
        sql`not exists (select 1 from marketing_suppression m where m.email = lower(trim(${s.email})) and m.opt_out_at is not null)`
      )
    )
    .orderBy(asc(s.updatedAt))
    .limit(limit * 4);

  // Dedup adresów w pamięci (ta sama kobieta potrafi mieć kilka sesji) — bierzemy najświeższą.
  const byEmail = new Map<string, Candidate & { updatedAt: Date }>();
  for (const r of rows) {
    const email = normalizeEmail(r.email ?? "");
    if (!EMAIL_RE.test(email)) continue;
    const prev = byEmail.get(email);
    if (!prev || prev.updatedAt < r.updatedAt) {
      byEmail.set(email, { sessionId: r.id, email, name: r.name, category: r.category, updatedAt: r.updatedAt });
    }
  }
  return [...byEmail.values()].slice(0, limit).map(({ updatedAt: _u, ...c }) => c);
}

/**
 * Treść maila. Guardraile (voice.md): bez „0 zł" i „za darmo", dofinansowanie tylko jako
 * „nawet do 95%", forma bezosobowa redakcji, adresat „Ty", bez myślnika-pauzy.
 * Wysyłamy tekst bez HTML — tak jak pozostałe maile transakcyjne (`deliver` używa `text`).
 */
export function buildReminderMessage(params: {
  name: string | null;
  category: string | null;
  resumeUrl: string;
  unsubUrl: string;
}): { subject: string; body: string } {
  const zakres = params.category
    ? `Zaczęłaś aplikację na szkolenie z zakresu: ${params.category}.`
    : "Zaczęłaś aplikację na szkolenie z dofinansowaniem.";
  const body = renderTemplate(
    [
      "Dzień dobry {{imie}},",
      "",
      "{{zakres}} Zostało kilka kroków, a odpowiedzi, które już podałaś, są zapisane.",
      "",
      "Po złożeniu aplikacji sprawdzamy, jakie dofinansowanie przysługuje Ci w Twoim województwie (nawet do 95%, zależnie od naboru i sytuacji zawodowej), i dobieramy akademię z wpisem do Bazy Usług Rozwojowych.",
      "",
      "Dokończ aplikację od miejsca, w którym przerwałaś:",
      "{{resume}}",
      "",
      "To jedyne przypomnienie w tej sprawie. Jeśli aplikacja była pomyłką, wystarczy nie robić nic.",
      "",
      "Zespół Uniwersytet Beauty",
      "biuro@uniwersytetbeauty.pl · uniwersytetbeauty.pl",
      "",
      "Dostajesz tę wiadomość, bo w aplikacji zaznaczyłaś zgodę na kontakt w jej sprawie, w tym przypomnienie o dokończeniu.",
      "Nie chcesz więcej wiadomości od nas? {{unsub}}",
    ].join("\n"),
    {
      imie: greetingName(params.name) || "",
      zakres,
      resume: params.resumeUrl,
      unsub: params.unsubUrl,
    }
  )
    // Brak imienia: „Dzień dobry ," → „Dzień dobry,"
    .replace("Dzień dobry ,", "Dzień dobry,");
  return { subject: REMINDER_SUBJECT, body };
}

export type EnqueueFn = (m: {
  to: string;
  subject: string;
  body: string;
  headers: Record<string, string>;
}) => Promise<{ queueId?: number }>;

export type RunDeps = {
  now?: Date;
  enabled?: boolean;
  siteUrl: string;
  /** Token do linku wypisania (istniejący mechanizm `marketing_suppression`). */
  unsubscribeToken: (email: string) => Promise<string>;
  enqueue: EnqueueFn;
};

export type RunResult = { enabled: boolean; candidates: number; queued: number; skipped: number; failed: number };

/**
 * Jedno uruchomienie: wybiera kandydatki, ZANIM wyśle, rezerwuje adres w `abandoned_reminders`
 * (UNIQUE — wyścig dwóch cronów nie zdubluje maila), potem kolejkuje wiadomość.
 * Gdy kolejkowanie rzuci błędem, rezerwacja jest zwalniana, żeby następny przebieg spróbował ponownie.
 */
export async function runAbandonedMailerCore(db: AnyDb, deps: RunDeps): Promise<RunResult> {
  const enabled = deps.enabled ?? isMailerEnabled();
  if (!enabled) return { enabled: false, candidates: 0, queued: 0, skipped: 0, failed: 0 };

  const now = deps.now ?? new Date();
  const candidates = await findCandidates(db, now);
  const result: RunResult = { enabled: true, candidates: candidates.length, queued: 0, skipped: 0, failed: 0 };

  for (const c of candidates) {
    const token = randomBytes(32).toString("hex");
    const [claimed] = await db
      .insert(schema.abandonedReminders)
      .values({ email: c.email, quizSessionId: c.sessionId, resumeToken: token })
      .onConflictDoNothing({ target: schema.abandonedReminders.email })
      .returning({ id: schema.abandonedReminders.id });
    if (!claimed) {
      result.skipped++;
      continue;
    }

    try {
      const unsubToken = await deps.unsubscribeToken(c.email);
      const unsubUrl = `${deps.siteUrl}/wypisz/${unsubToken}`;
      const msg = buildReminderMessage({
        name: c.name,
        category: c.category,
        resumeUrl: `${deps.siteUrl}/aplikacja?wznow=${token}`,
        unsubUrl,
      });
      const res = await deps.enqueue({
        to: c.email,
        subject: msg.subject,
        body: msg.body,
        headers: {
          "List-Unsubscribe": `<${deps.siteUrl}/api/wypisz?token=${unsubToken}>, <mailto:biuro@uniwersytetbeauty.pl?subject=Wypisz>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      await db
        .update(schema.abandonedReminders)
        .set({ emailQueueId: res.queueId ?? null })
        .where(eq(schema.abandonedReminders.id, claimed.id));
      result.queued++;
    } catch (err) {
      console.error("[porzucone] kolejkowanie nie powiodło się:", err);
      await db.delete(schema.abandonedReminders).where(eq(schema.abandonedReminders.id, claimed.id));
      result.failed++;
    }
  }
  return result;
}

/**
 * Wznowienie po tokenie z linku. Zwraca zapisane odpowiedzi albo `null`, gdy token nie istnieje,
 * wygasł (RESUME_TOKEN_TTL_DAYS) albo aplikacja jest już dokończona.
 */
export async function loadResumeByToken(db: AnyDb, token: string, now = new Date()) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await db
    .select({ reminder: schema.abandonedReminders, session: schema.quizSessions })
    .from(schema.abandonedReminders)
    .innerJoin(schema.quizSessions, eq(schema.abandonedReminders.quizSessionId, schema.quizSessions.id))
    .where(eq(schema.abandonedReminders.resumeToken, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (now.getTime() - row.reminder.createdAt.getTime() > RESUME_TOKEN_TTL_DAYS * 86_400_000) return null;
  if (row.session.completed || row.session.leadId) return null;
  return row.session;
}

export type ReminderInfo = { createdAt: Date; status: "w_kolejce" | "wyslany" | "blad" | null; sentAt: Date | null };

/** Stan przypomnień dla listy w panelu, po znormalizowanym adresie (rejestr jest kluczowany adresem). */
export async function reminderStatusByEmail(db: AnyDb, emails: string[]): Promise<Map<string, ReminderInfo>> {
  const map = new Map<string, ReminderInfo>();
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (normalized.length === 0) return map;
  const rows = await db
    .select({
      email: schema.abandonedReminders.email,
      createdAt: schema.abandonedReminders.createdAt,
      status: schema.emailQueue.status,
      sentAt: schema.emailQueue.sentAt,
    })
    .from(schema.abandonedReminders)
    .leftJoin(schema.emailQueue, eq(schema.abandonedReminders.emailQueueId, schema.emailQueue.id))
    .where(inArray(schema.abandonedReminders.email, normalized));
  for (const r of rows) map.set(r.email, { createdAt: r.createdAt, status: r.status, sentAt: r.sentAt });
  return map;
}
