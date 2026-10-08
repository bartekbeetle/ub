import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { pipelineAssign } from "@/lib/pipeline";

export const runtime = "nodejs";

type Params = Promise<{ leadId: string }>;

/** Przypisanie kursantki z lejka na tablicę trenerki. 🔴 Bez maila do trenerki (dane dopiero po umowie). */
export async function POST(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const leadId = Number((await params).leadId);
  const parsed = z.object({ boardId: z.number().int().positive() }).safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(leadId) || !parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  const res = await pipelineAssign(user, leadId, parsed.data.boardId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res, { status: 201 });
}
