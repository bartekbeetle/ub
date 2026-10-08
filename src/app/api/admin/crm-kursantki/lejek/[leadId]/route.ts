import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { pipelineQualify } from "@/lib/pipeline";
import { FUNNEL_STAGES } from "@/lib/pipeline-stages";

export const runtime = "nodejs";

type Params = Promise<{ leadId: string }>;

/** Kwalifikacja kursantki w lejku (nowa / zakwalifikowana / odrzucona). */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const leadId = Number((await params).leadId);
  const parsed = z.object({ stage: z.enum(FUNNEL_STAGES) }).safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(leadId) || !parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  const res = await pipelineQualify(user, leadId, parsed.data.stage);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
