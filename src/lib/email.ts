import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Wysyła email albo — gdy brak SMTP w env — zostawia go w kolejce (email_queue).
 * Aplikacja NIGDY nie wywala się przez brak konfiguracji mailowej.
 */
export async function sendOrQueueEmail(params: {
  to: string;
  subject: string;
  body: string;
  leadId?: number | null;
}): Promise<{ sent: boolean }> {
  const db = await getDb();
  const [queued] = await db
    .insert(schema.emailQueue)
    .values({
      toEmail: params.to,
      subject: params.subject,
      body: params.body,
      leadId: params.leadId ?? null,
    })
    .returning();

  if (!smtpConfigured()) {
    console.log(`[email] SMTP nieskonfigurowane — mail do ${params.to} w kolejce (id=${queued.id})`);
    return { sent: false };
  }

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
      to: params.to,
      subject: params.subject,
      text: params.body,
    });
    await db
      .update(schema.emailQueue)
      .set({ status: "wyslany", sentAt: new Date() })
      .where(eq(schema.emailQueue.id, queued.id));
    return { sent: true };
  } catch (err) {
    await db
      .update(schema.emailQueue)
      .set({ status: "blad", error: err instanceof Error ? err.message : String(err) })
      .where(eq(schema.emailQueue.id, queued.id));
    console.error("[email] Błąd wysyłki:", err);
    return { sent: false };
  }
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
