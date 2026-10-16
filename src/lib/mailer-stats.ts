import "server-only";
import { and, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Liczby pulpitu mailera (16.10.2026) — wszystko z `email_queue`, jedynego miejsca,
 * przez które przechodzi każdy mail z aplikacji. Wzór na wskaźniki jak w MailerLite:
 *  - otwarcia % = otwarte / wysłane ZE ŚLEDZENIEM (maile bez piksela nie mogą zostać „otwarte”),
 *  - kliknięcia % = kliknięte / wysłane ze śledzeniem,
 *  - CTOR = kliknięte / otwarte.
 */

export const KIND_LABELS: Record<string, string> = {
  kursantka_potwierdzenie: "Potwierdzenie zgłoszenia",
  kursantka_zapis: "Potwierdzenie zapisu",
  trenerka_lead: "Nowy lead do akademii",
  porzucona_aplikacja: "Dokończ aplikację",
  akademia_powitanie: "Powitanie akademii",
  marketing: "Kampania",
  trenerka_crm: "Wiadomość z CRM akademii",
  wewnetrzne_zapis: "Wewnętrzne: zapis",
  wewnetrzne_akademia: "Wewnętrzne: nowa akademia",
  inne: "Inne",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind.split(":")[0]] ?? kind;
}

const q = schema.emailQueue;
const baseKind = sql<string>`split_part(${q.kind}, ':', 1)`;

const metrics = {
  sent: sql<number>`count(*) filter (where ${q.status} = 'wyslany')::int`,
  failed: sql<number>`count(*) filter (where ${q.status} = 'blad')::int`,
  tracked: sql<number>`count(*) filter (where ${q.status} = 'wyslany' and ${q.trackToken} is not null)::int`,
  opened: sql<number>`count(*) filter (where ${q.openedAt} is not null)::int`,
  clicked: sql<number>`count(*) filter (where ${q.clickedAt} is not null)::int`,
};

export type Metrics = { sent: number; failed: number; tracked: number; opened: number; clicked: number };

export function rates(m: Metrics) {
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  return { openRate: pct(m.opened, m.tracked), clickRate: pct(m.clicked, m.tracked), ctor: pct(m.clicked, m.opened) };
}

export async function mailerOverview(days = 30) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86_400_000);

  const [totals] = await db.select(metrics).from(q).where(gte(q.createdAt, since));
  const [queued] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(q)
    .where(and(inArray(q.status, ["w_kolejce"]), gte(q.createdAt, new Date(Date.now() - 7 * 86_400_000))));
  const [unsub] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.marketingSuppression)
    .where(and(isNotNull(schema.marketingSuppression.optOutAt), gte(schema.marketingSuppression.optOutAt, since)));

  const byKind = await db
    .select({ kind: baseKind, ...metrics, lastAt: sql<Date | null>`max(${q.sentAt})` })
    .from(q)
    .where(gte(q.createdAt, since))
    .groupBy(baseKind);

  const monthly = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${q.createdAt}), 'YYYY-MM')`,
      ...metrics,
    })
    .from(q)
    .where(gte(q.createdAt, new Date(Date.now() - 183 * 86_400_000)))
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`);

  return { totals: totals as Metrics, queued: queued?.c ?? 0, unsubscribed: unsub?.c ?? 0, byKind, monthly };
}

/** Metryki dla każdej kampanii: odbiorcy → wiersz kolejki → otwarcia/kliknięcia. */
export async function campaignTracking(): Promise<Map<number, Metrics>> {
  const db = await getDb();
  const rows = await db
    .select({ campaignId: schema.mailingRecipients.campaignId, ...metrics })
    .from(schema.mailingRecipients)
    .innerJoin(q, sql`${q.id} = ${schema.mailingRecipients.emailQueueId}`)
    .groupBy(schema.mailingRecipients.campaignId);
  return new Map(rows.map((r) => [r.campaignId, r]));
}
