import "server-only";
import { getDb } from "@/db";
import { EMAIL_KIND, sendOrQueueEmail } from "@/lib/email";
import { getSmsProvider } from "@/lib/sms";
import { updateTrainerAssignmentStatus } from "@/lib/assignment-status";
import type { User } from "@/db/schema";
import * as core from "@/lib/crm-core";

export * from "@/lib/crm-core";

/**
 * Wiring CRM trenerki na prawdziwą bazę, prawdziwą kolejkę maili, prawdziwego dostawcę SMS
 * i prawdziwą funkcję naliczającą. Cała logika (i izolacja) jest w `crm-core.ts`.
 * Każda funkcja bierze `user` z `requireTrainer()` i używa WYŁĄCZNIE `user.trainerId`.
 */

function trainerIdOf(user: User): number {
  if (user.role !== "trenerka" || !user.trainerId) throw new Error("Brak przypisanej trenerki.");
  return user.trainerId;
}

export async function crmChangeStage(user: User, assignmentId: number, input: { stage: core.CrmStage; rejectionReason?: string }) {
  const db = await getDb();
  const trainerId = trainerIdOf(user);
  return core.changeStage(db, trainerId, assignmentId, input, {
    applyStatus: (i) =>
      updateTrainerAssignmentStatus({ user, trainerId, assignmentId, input: i }),
  });
}

export async function crmSendEmail(user: User, assignmentId: number, subject: string, body: string) {
  const db = await getDb();
  return core.sendCrmEmail(
    db,
    { trainerId: trainerIdOf(user), accountEmail: user.email, assignmentId, subject, body },
    {
      enqueue: async (m) => {
        const r = await sendOrQueueEmail({
          to: m.to,
          subject: m.subject,
          body: m.body,
          leadId: m.leadId,
          kind: EMAIL_KIND.TRENERKA_CRM,
          // Korespondencja 1:1 NIE jest powiadomieniem: dedup po (lead, kind) po cichu zgubiłby
          // drugą wiadomość tej samej trenerki, a przy multi-sellu także pierwszą wiadomość
          // drugiej trenerki do tej samej kursantki.
          dedupe: false,
          fromName: m.fromName,
          replyTo: m.replyTo,
        });
        return { queueId: r.queueId };
      },
    }
  );
}

export async function crmSendSms(user: User, assignmentId: number, text: string) {
  const db = await getDb();
  return core.sendCrmSms(db, { trainerId: trainerIdOf(user), assignmentId, text }, { provider: getSmsProvider() });
}

export async function crmAddNote(user: User, assignmentId: number, body: string) {
  return core.addNote(await getDb(), trainerIdOf(user), assignmentId, body);
}
export async function crmSetReminder(user: User, assignmentId: number, ymd: string | null) {
  return core.setReminder(await getDb(), trainerIdOf(user), assignmentId, ymd);
}
export async function crmList(user: User) {
  return core.listCrmLeads(await getDb(), trainerIdOf(user));
}
export async function crmDetail(user: User, assignmentId: number) {
  return core.getCrmDetail(await getDb(), trainerIdOf(user), assignmentId);
}
export async function crmTemplates(user: User) {
  return core.listTemplates(await getDb(), trainerIdOf(user));
}
export async function crmUsage(user: User) {
  return core.dailyUsage(await getDb(), trainerIdOf(user));
}
