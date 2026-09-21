import "server-only";
import { and, eq, gte, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { buildMarketingMessage, isSmtpConfigured, sendMarketingEmail } from "./email";
import { normalizeEmail } from "./marketing-list";
import { renderTemplate } from "./template";
import { greetingName } from "./template";
import { voivodeshipName } from "./constants";

/**
 * MAILING — dobór odbiorców, zamrożenie listy i wysyłka partiami.
 *
 * 🔴 Zasada, od której zaczyna się wszystko poniżej: **jedyną podstawą wysyłki jest
 * zaznaczona zgoda marketingowa** (`marketingConsentAt IS NOT NULL`), art. 398 Prawa
 * komunikacji elektronicznej. Nie ma segmentu „wszyscy" i nie wolno go dorabiać.
 * `contactConsentAt` to podstawa maila serwisowego o TEJ aplikacji („dokończ zgłoszenie"),
 * a nie zgoda na propozycje szkoleń — pomylenie tych dwóch to nie drobiazg redakcyjny,
 * tylko wysyłka bez podstawy prawnej.
 */

/** Filtry segmentu. Pusty obiekt = wszyscy ze zgodą marketingową. */
export type MailingSegment = {
  /** `lead` — doszła do końca aplikacji; `aplikacja` — porzuciła w trakcie, ale dała zgodę. */
  sources?: ("lead" | "aplikacja")[];
  categories?: string[];
  voivodeships?: string[];
  /** Tylko zgłoszenia od tej daty (ISO `YYYY-MM-DD`). */
  since?: string | null;
};

export type AudienceRow = {
  email: string;
  name: string | null;
  sourceKind: "lead" | "aplikacja";
  leadId: number | null;
  category: string | null;
  voivodeship: string | null;
};

function wantsSource(segment: MailingSegment, source: "lead" | "aplikacja"): boolean {
  if (!segment.sources || segment.sources.length === 0) return true;
  return segment.sources.includes(source);
}

/**
 * Buduje listę odbiorców z DWÓCH tabel i skleja ją po znormalizowanym adresie.
 *
 * Dlaczego dedup jest tu, a nie w bazie: ta sama kobieta bywa jednocześnie leadem
 * i porzuconą sesją aplikacji (a bywa też dwoma leadami — w panelu leży duplikat z 15.09).
 * Bez sklejenia dostałaby dwie albo trzy kopie jednej kampanii.
 * Pierwszeństwo ma wiersz z `leads`: ma pewniejsze imię i `leadId` do powiązania.
 */
export async function buildAudience(segment: MailingSegment): Promise<AudienceRow[]> {
  const db = await getDb();
  const byEmail = new Map<string, AudienceRow>();
  const since = segment.since ? new Date(segment.since) : null;

  if (wantsSource(segment, "lead")) {
    const conditions = [
      isNotNull(schema.leads.marketingConsentAt),
      // Lead zanonimizowany na żądanie RODO ma pusty adres — nie ma dokąd pisać.
      isNull(schema.leads.anonymizedAt),
      ne(schema.leads.email, ""),
    ];
    if (segment.categories?.length) conditions.push(inArray(schema.leads.category, segment.categories));
    if (segment.voivodeships?.length)
      conditions.push(inArray(schema.leads.voivodeship, segment.voivodeships));
    if (since) conditions.push(gte(schema.leads.createdAt, since));

    const rows = await db
      .select({
        id: schema.leads.id,
        email: schema.leads.email,
        name: schema.leads.name,
        category: schema.leads.category,
        voivodeship: schema.leads.voivodeship,
      })
      .from(schema.leads)
      .where(and(...conditions));

    for (const r of rows) {
      const key = normalizeEmail(r.email ?? "");
      if (!key) continue;
      if (!byEmail.has(key)) {
        byEmail.set(key, {
          email: key,
          name: r.name,
          sourceKind: "lead",
          leadId: r.id,
          category: r.category,
          voivodeship: r.voivodeship,
        });
      }
    }
  }

  if (wantsSource(segment, "aplikacja")) {
    const conditions = [
      isNotNull(schema.quizSessions.marketingConsentAt),
      isNotNull(schema.quizSessions.email),
      // Ukończona sesja ma już swojego leada — ten sam człowiek wszedłby dwa razy.
      eq(schema.quizSessions.completed, false),
    ];
    if (segment.categories?.length)
      conditions.push(inArray(schema.quizSessions.category, segment.categories));
    if (segment.voivodeships?.length)
      conditions.push(inArray(schema.quizSessions.voivodeship, segment.voivodeships));
    if (since) conditions.push(gte(schema.quizSessions.createdAt, since));

    const rows = await db
      .select({
        email: schema.quizSessions.email,
        name: schema.quizSessions.name,
        category: schema.quizSessions.category,
        voivodeship: schema.quizSessions.voivodeship,
        leadId: schema.quizSessions.leadId,
      })
      .from(schema.quizSessions)
      .where(and(...conditions));

    for (const r of rows) {
      const key = normalizeEmail(r.email ?? "");
      if (!key) continue;
      if (!byEmail.has(key)) {
        byEmail.set(key, {
          email: key,
          name: r.name,
          sourceKind: "aplikacja",
          leadId: r.leadId ?? null,
          category: r.category,
          voivodeship: r.voivodeship,
        });
      }
    }
  }

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email, "pl"));
}

/**
 * Odsiewa wypisanych JEDNYM zapytaniem.
 *
 * `filterSubscribed` z `marketing-list` robi osobny SELECT na adres — przy liście
 * kilkuset osób to kilkaset zapytań. Przy liczeniu podglądu odpalanym przy każdej zmianie
 * filtra w panelu byłoby to widać natychmiast.
 */
async function removeUnsubscribed(rows: AudienceRow[]): Promise<AudienceRow[]> {
  if (rows.length === 0) return rows;
  const db = await getDb();
  const optedOut = await db
    .select({ email: schema.marketingSuppression.email })
    .from(schema.marketingSuppression)
    .where(
      and(
        inArray(
          schema.marketingSuppression.email,
          rows.map((r) => r.email)
        ),
        isNotNull(schema.marketingSuppression.optOutAt)
      )
    );
  const blocked = new Set(optedOut.map((r) => r.email));
  return rows.filter((r) => !blocked.has(r.email));
}

/** Podgląd segmentu dla panelu: ilu odbiorców i ilu odpadło przez wypisanie. */
export async function previewAudience(segment: MailingSegment): Promise<{
  total: number;
  unsubscribed: number;
  sample: AudienceRow[];
}> {
  const all = await buildAudience(segment);
  const subscribed = await removeUnsubscribed(all);
  return {
    total: subscribed.length,
    unsubscribed: all.length - subscribed.length,
    sample: subscribed.slice(0, 10),
  };
}

/** Zmienne dostępne w treści mailingu. Świadomie wąski zestaw — mailing idzie do wielu osób naraz. */
export function recipientVars(row: {
  name: string | null;
  email: string;
  category?: string | null;
  voivodeship?: string | null;
}): Record<string, string> {
  return {
    imie_wolacz: greetingName(row.name) || "Pani",
    imie: row.name ?? "",
    email: row.email,
    kategoria: row.category ?? "",
    wojewodztwo: voivodeshipName(row.voivodeship),
  };
}

/**
 * Zamraża listę odbiorców kampanii. Od tej chwili zmiana filtrów nie rusza tego, co
 * zostało wysłane — inaczej po przerwanej partii nie dałoby się dokończyć wysyłki
 * bez ryzyka, że ktoś dostanie drugi raz, a ktoś inny w ogóle.
 */
export async function prepareCampaign(campaignId: number): Promise<{ recipients: number }> {
  const db = await getDb();
  const [campaign] = await db
    .select()
    .from(schema.mailingCampaigns)
    .where(eq(schema.mailingCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new Error("Kampania nie istnieje.");
  if (campaign.status !== "szkic") throw new Error("Lista odbiorców jest już zamrożona.");

  const audience = await removeUnsubscribed(
    await buildAudience((campaign.segment ?? {}) as MailingSegment)
  );

  if (audience.length > 0) {
    await db
      .insert(schema.mailingRecipients)
      .values(
        audience.map((r) => ({
          campaignId,
          email: r.email,
          name: r.name,
          sourceKind: r.sourceKind,
          leadId: r.leadId,
        }))
      )
      // Dwa kliknięcia „Przygotuj" nie mogą zdublować listy.
      .onConflictDoNothing();
  }

  await db
    .update(schema.mailingCampaigns)
    .set({ status: "gotowa", preparedAt: new Date() })
    .where(eq(schema.mailingCampaigns.id, campaignId));

  return { recipients: audience.length };
}

/**
 * Wysyła JEDNĄ partię. Panel woła to w pętli aż do `done: true`.
 *
 * Dlaczego partiami, a nie jednym żądaniem: wysyłka setek maili przez SMTP trwa minuty
 * i padłaby na limicie czasu żądania, zostawiając kampanię w stanie nie do odtworzenia.
 * Partia zapisuje wynik każdego odbiorcy od razu, więc przerwanie w połowie nic nie psuje.
 */
export async function sendCampaignBatch(
  campaignId: number,
  batchSize = 25
): Promise<{ processed: number; sent: number; queued: number; skipped: number; failed: number; done: boolean }> {
  const db = await getDb();
  const [campaign] = await db
    .select()
    .from(schema.mailingCampaigns)
    .where(eq(schema.mailingCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new Error("Kampania nie istnieje.");
  if (campaign.status === "szkic") throw new Error("Najpierw przygotuj listę odbiorców.");

  if (campaign.status === "gotowa") {
    await db
      .update(schema.mailingCampaigns)
      .set({ status: "wysylanie", startedAt: campaign.startedAt ?? new Date() })
      .where(eq(schema.mailingCampaigns.id, campaignId));
  }

  const pending = await db
    .select()
    .from(schema.mailingRecipients)
    .where(
      and(
        eq(schema.mailingRecipients.campaignId, campaignId),
        eq(schema.mailingRecipients.status, "oczekuje")
      )
    )
    .limit(batchSize);

  let sent = 0;
  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of pending) {
    const vars = recipientVars(row);
    try {
      const res = await sendMarketingEmail({
        to: row.email,
        subject: renderTemplate(campaign.subject, vars),
        body: renderTemplate(campaign.body, vars),
        leadId: row.leadId,
        // Dedup robi unikalny indeks `mailing_recipients (campaign_id, email)`.
        // Gdyby zostawić domyślne `true`, druga kampania do tej samej osoby zostałaby
        // po cichu pominięta, bo „marketing" już kiedyś do niej poszedł.
        dedupe: false,
      });

      if (res.skipped) {
        skipped++;
        await db
          .update(schema.mailingRecipients)
          .set({
            status: "pominiety",
            reason: res.reason ?? "pominięty",
            processedAt: new Date(),
            emailQueueId: res.queueId ?? null,
          })
          .where(eq(schema.mailingRecipients.id, row.id));
        continue;
      }

      // 🔴 Tu mieszka uczciwość panelu: `sent: false` przy braku SMTP NIE jest błędem,
      // ale też NIE jest wysyłką. Mail leży w kolejce i pójdzie, gdy dane SMTP się pojawią.
      if (res.sent) sent++;
      else queued++;

      await db
        .update(schema.mailingRecipients)
        .set({
          status: res.sent ? "wyslany" : "w_kolejce",
          processedAt: new Date(),
          emailQueueId: res.queueId ?? null,
          reason: res.sent ? null : "czeka w kolejce (brak konfiguracji SMTP albo nieudana próba)",
        })
        .where(eq(schema.mailingRecipients.id, row.id));
    } catch (err) {
      failed++;
      await db
        .update(schema.mailingRecipients)
        .set({
          status: "blad",
          reason: err instanceof Error ? err.message : String(err),
          processedAt: new Date(),
        })
        .where(eq(schema.mailingRecipients.id, row.id));
    }
  }

  const [rest] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.mailingRecipients)
    .where(
      and(
        eq(schema.mailingRecipients.campaignId, campaignId),
        eq(schema.mailingRecipients.status, "oczekuje")
      )
    );
  const done = (rest?.c ?? 0) === 0;

  if (done) {
    await db
      .update(schema.mailingCampaigns)
      .set({ status: "zakonczona", finishedAt: new Date() })
      .where(eq(schema.mailingCampaigns.id, campaignId));
  }

  return { processed: pending.length, sent, queued, skipped, failed, done };
}

/**
 * Statystyki kampanii — **doręczenia czytamy z `email_queue`, nie z naszych statusów.**
 *
 * Powód jest konkretny: przy nieskonfigurowanym SMTP `sendOrQueueEmail` wkłada maila
 * do kolejki i zwraca `{sent: false}` bez rzucania wyjątku. Panel, który liczyłby
 * „wysłane" po tym, że pętla przeszła, pokazywałby wysyłkę, której nie było.
 */
export async function campaignStats(campaignId: number): Promise<{
  total: number;
  oczekuje: number;
  wKolejce: number;
  pominiety: number;
  blad: number;
  /** Realnie przyjęte przez serwer pocztowy — z `email_queue.status = 'wyslany'`. */
  doreczone: number;
}> {
  const db = await getDb();
  const rows = await db
    .select({ status: schema.mailingRecipients.status, c: sql<number>`count(*)::int` })
    .from(schema.mailingRecipients)
    .where(eq(schema.mailingRecipients.campaignId, campaignId))
    .groupBy(schema.mailingRecipients.status);

  const by = (s: string) => rows.find((r) => r.status === s)?.c ?? 0;

  const [delivered] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.mailingRecipients)
    .innerJoin(schema.emailQueue, eq(schema.mailingRecipients.emailQueueId, schema.emailQueue.id))
    .where(
      and(
        eq(schema.mailingRecipients.campaignId, campaignId),
        eq(schema.emailQueue.status, "wyslany")
      )
    );

  return {
    total: rows.reduce((sum, r) => sum + r.c, 0),
    oczekuje: by("oczekuje"),
    wKolejce: by("w_kolejce"),
    pominiety: by("pominiety"),
    blad: by("blad"),
    doreczone: delivered?.c ?? 0,
  };
}

/** Podgląd treści dokładnie taki, jaki wyjdzie — ze stopką rezygnacji i podstawionymi zmiennymi. */
export async function previewMessage(params: {
  subject: string;
  body: string;
  sampleFor?: AudienceRow | null;
  previewTo: string;
}): Promise<{ subject: string; body: string; smtpReady: boolean }> {
  const vars = params.sampleFor
    ? recipientVars(params.sampleFor)
    : recipientVars({ name: "Anna Nowak", email: params.previewTo, category: "Stylizacja brwi", voivodeship: "slaskie" });

  const message = await buildMarketingMessage(params.previewTo, renderTemplate(params.body, vars));
  return {
    subject: renderTemplate(params.subject, vars),
    body: message.body,
    smtpReady: isSmtpConfigured(),
  };
}
