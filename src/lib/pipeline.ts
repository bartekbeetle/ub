import "server-only";
import { getDb } from "@/db";
import type { User } from "@/db/schema";
import { logAdminAction, actorLabel } from "@/lib/audit";
import { isSuperadminRole } from "@/lib/roles";
import * as core from "@/lib/pipeline-core";
import type { FunnelStage, PipelineStage } from "@/lib/pipeline-stages";

export * from "@/lib/pipeline-core";

/**
 * Wiring CRM admina na prawdziwą bazę i dziennik adminów. Logika w `pipeline-core.ts`.
 * Każda funkcja bierze `user` z `requireAdmin()`. Żadna nie wysyła maili ani SMS-ów.
 */
const auditOf = (user: User) => (p: Parameters<typeof logAdminAction>[1]) => logAdminAction(user, p);

export async function pipelineBoards() {
  return core.listBoards(await getDb());
}

export async function pipelineFunnel() {
  return core.listFunnel(await getDb());
}

export async function pipelineBoardCards(boardId: number) {
  return core.listBoardCards(await getDb(), boardId);
}

export async function pipelineBoard(boardId: number) {
  return core.getBoard(await getDb(), boardId);
}

export async function pipelineCreateTrainer(user: User, input: core.NewTrainerInput) {
  return core.createTrainerWithBoards(await getDb(), input, { audit: auditOf(user) });
}

export async function pipelineAddBoard(user: User, input: { trainerId: number; category: string }) {
  return core.addBoard(await getDb(), input, { audit: auditOf(user) });
}

export async function pipelineQualify(user: User, leadId: number, stage: FunnelStage) {
  return core.setQualification(await getDb(), leadId, stage, { audit: auditOf(user) });
}

export async function pipelineAssign(user: User, leadId: number, boardId: number) {
  return core.assignToBoard(await getDb(), { leadId, boardId, actor: actorLabel(user) }, { audit: auditOf(user) });
}

export async function pipelineMove(
  user: User,
  input: { boardId: number; assignmentId: number; to: PipelineStage; reason?: string }
) {
  return core.moveCard(
    await getDb(),
    { ...input, user, canUndoSigned: isSuperadminRole(user.role) },
    { audit: auditOf(user) }
  );
}
