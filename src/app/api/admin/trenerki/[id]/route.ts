import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { trainerSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const trainerId = Number(id);
  const parsed = trainerSchema.partial().safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(trainerId) || !parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const db = await getDb();
  const d = parsed.data;
  const [updated] = await db
    .update(schema.trainers)
    .set({
      ...d,
      ...(d.email !== undefined ? { email: d.email || null } : {}),
      ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      ...(d.voivodeship !== undefined ? { voivodeship: d.voivodeship || null } : {}),
      ...(d.avatarUrl !== undefined ? { avatarUrl: d.avatarUrl || null } : {}),
      ...(d.coverUrl !== undefined ? { coverUrl: d.coverUrl || null } : {}),
    })
    .where(eq(schema.trainers.id, trainerId))
    .returning();
  if (!updated) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  await logAudit({ actor: actorLabel(user), action: "trenerka_edytowana", entityType: "trainer", entityId: trainerId });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const trainerId = Number(id);
  if (!Number.isInteger(trainerId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });
  const db = await getDb();
  // soft-delete: dezaktywacja (żeby nie zerwać rozliczeń i historii)
  const [updated] = await db
    .update(schema.trainers)
    .set({ isActive: false })
    .where(eq(schema.trainers.id, trainerId))
    .returning();
  if (!updated) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  await logAudit({ actor: actorLabel(user), action: "trenerka_dezaktywowana", entityType: "trainer", entityId: trainerId });
  return NextResponse.json({ ok: true });
}
