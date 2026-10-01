import "server-only";
import { desc, inArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Kim jest nadawca maila — z naszej bazy. Jedno złączenie po adresie odpowiada na pytanie,
 * z którym kursantki realnie piszą: „czy doszła moja aplikacja?". Obok maila widać jej
 * leady, zgłoszenia i to, co (nie) wyszło do niej z kolejki.
 */
export type SenderContext = {
  leads: { id: number; name: string; category: string; voivodeship: string; status: string; createdAt: Date }[];
  submissions: { id: number; type: string; createdAt: Date; convertedToLeadId: number | null }[];
  emails: { id: number; subject: string; status: string; kind: string; createdAt: Date; sentAt: Date | null }[];
};

const norm = (e: string) => e.trim().toLowerCase();

export async function senderContext(emails: string[]): Promise<Map<string, SenderContext>> {
  const list = [...new Set(emails.map(norm).filter(Boolean))];
  const out = new Map<string, SenderContext>();
  if (!list.length) return out;
  for (const e of list) out.set(e, { leads: [], submissions: [], emails: [] });

  const db = await getDb();
  const [leads, submissions, queue] = await Promise.all([
    db
      .select({
        id: schema.leads.id,
        email: schema.leads.email,
        name: schema.leads.name,
        category: schema.leads.category,
        voivodeship: schema.leads.voivodeship,
        status: schema.leads.status,
        createdAt: schema.leads.createdAt,
      })
      .from(schema.leads)
      .where(inArray(sql`lower(${schema.leads.email})`, list))
      .orderBy(desc(schema.leads.createdAt)),
    db
      .select({
        id: schema.submissions.id,
        email: schema.submissions.email,
        type: schema.submissions.type,
        createdAt: schema.submissions.createdAt,
        convertedToLeadId: schema.submissions.convertedToLeadId,
      })
      .from(schema.submissions)
      .where(inArray(sql`lower(${schema.submissions.email})`, list))
      .orderBy(desc(schema.submissions.createdAt)),
    db
      .select({
        id: schema.emailQueue.id,
        toEmail: schema.emailQueue.toEmail,
        subject: schema.emailQueue.subject,
        status: schema.emailQueue.status,
        kind: schema.emailQueue.kind,
        createdAt: schema.emailQueue.createdAt,
        sentAt: schema.emailQueue.sentAt,
      })
      .from(schema.emailQueue)
      .where(or(inArray(sql`lower(${schema.emailQueue.toEmail})`, list)))
      .orderBy(desc(schema.emailQueue.createdAt)),
  ]);

  for (const l of leads) out.get(norm(l.email))?.leads.push(l);
  for (const s of submissions) out.get(norm(s.email))?.submissions.push(s);
  for (const q of queue) out.get(norm(q.toEmail))?.emails.push(q);
  return out;
}
