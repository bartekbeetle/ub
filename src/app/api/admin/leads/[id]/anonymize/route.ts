import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

/** RODO: anonimizacja danych leada na żądanie (prawo do bycia zapomnianą). */
export async function POST(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const db = await getDb();
  const [updated] = await db
    .update(schema.leads)
    .set({
      name: "[zanonimizowano]",
      phone: "[zanonimizowano]",
      email: `zanonimizowano-${leadId}@rodo.local`,
      message: null,
      notes: null,
      preferredDate: null,
      anonymizedAt: new Date(),
    })
    .where(eq(schema.leads.id, leadId))
    .returning();
  if (!updated) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  await logAudit({ actor: actorLabel(user), action: "anonimizacja_rodo", entityType: "lead", entityId: leadId });
  return NextResponse.json({ ok: true });
}
