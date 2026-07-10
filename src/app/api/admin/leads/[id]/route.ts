import { NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { leadStatusUpdateSchema } from "@/lib/validators";
import { z } from "zod";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  return NextResponse.json(rows[0]);
}

const patchSchema = z.union([
  leadStatusUpdateSchema.extend({ notes: z.string().max(4000).optional() }),
  z.object({ notes: z.string().max(4000) }),
]);

export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  const lead = rows[0];
  if (!lead) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  const data = parsed.data;
  const update: Partial<typeof schema.leads.$inferInsert> = {};
  if ("notes" in data && data.notes !== undefined) update.notes = data.notes;

  if ("status" in data && data.status && data.status !== lead.status) {
    update.status = data.status;
    if (data.status === "odrzucony") update.rejectionReason = data.rejectionReason || null;

    // status "zapisana" -> naliczenie kwot dla przydziałów per-zapis
    if (data.status === "zapisana") {
      const assignments = await db
        .select({ assignment: schema.leadAssignments, trainer: schema.trainers })
        .from(schema.leadAssignments)
        .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
        .where(and(eq(schema.leadAssignments.leadId, leadId), ne(schema.leadAssignments.status, "odrzucony")));
      for (const { assignment, trainer } of assignments) {
        await db
          .update(schema.leadAssignments)
          .set({
            status: "zapisana",
            amount: trainer.billingModel === "per_zapis" ? trainer.rate : assignment.amount,
          })
          .where(eq(schema.leadAssignments.id, assignment.id));
      }
    }

    await logAudit({
      actor: actorLabel(user),
      action: "zmiana_statusu",
      entityType: "lead",
      entityId: leadId,
      details: { from: lead.status, to: data.status, ...(data.status === "odrzucony" ? { reason: data.rejectionReason } : {}) },
    });
  } else if ("notes" in data) {
    await logAudit({ actor: actorLabel(user), action: "notatka", entityType: "lead", entityId: leadId });
  }

  const [updated] = await db.update(schema.leads).set(update).where(eq(schema.leads.id, leadId)).returning();
  return NextResponse.json(updated);
}
