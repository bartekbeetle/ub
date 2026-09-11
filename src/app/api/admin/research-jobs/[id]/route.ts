import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { researchJobPatchSchema, zodErrorMessage } from "@/lib/validators";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const parsed = researchJobPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.researchJobs).where(eq(schema.researchJobs.id, jobId)).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Nie znaleziono zadania." }, { status: 404 });

  const status = parsed.data.status as typeof schema.researchJobs.$inferInsert.status;
  const closing = status === "gotowe" || status === "pominiete";

  const [updated] = await db
    .update(schema.researchJobs)
    .set({
      status,
      resultNotes: parsed.data.resultNotes ? parsed.data.resultNotes : rows[0].resultNotes,
      completedAt: closing ? new Date() : null,
    })
    .where(eq(schema.researchJobs.id, jobId))
    .returning();

  await logAudit({
    actor: actorLabel(user),
    action: "research_job_status",
    entityType: "research_job",
    entityId: jobId,
    details: { from: rows[0].status, to: status },
  });

  return NextResponse.json(updated);
}
