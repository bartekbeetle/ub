import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { pipelineMove } from "@/lib/pipeline";
import { PIPELINE_STAGES } from "@/lib/pipeline-stages";

export const runtime = "nodejs";

type Params = Promise<{ boardId: string; assignmentId: string }>;

/**
 * Przesunięcie karty na tablicy. Naliczenie („Wpłaciła") i cofnięcie (tylko superadmin) idą
 * przez wspólny rdzeń rozliczeń; maile przy naliczeniu są w tym miejscu WYŁĄCZONE.
 */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const p = await params;
  const boardId = Number(p.boardId);
  const assignmentId = Number(p.assignmentId);
  const parsed = z
    .object({ stage: z.enum(PIPELINE_STAGES), reason: z.string().max(1000).optional() })
    .safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(boardId) || !Number.isInteger(assignmentId) || !parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const res = await pipelineMove(user, { boardId, assignmentId, to: parsed.data.stage, reason: parsed.data.reason });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, stage: res.stage });
}
