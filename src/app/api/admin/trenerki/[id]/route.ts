import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { isSuperadminRole } from "@/lib/roles";
import { logAdminAction } from "@/lib/audit";
import { trainerSchema, zodErrorMessage } from "@/lib/validators";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/public-cache";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const trainerId = Number(id);
  if (!Number.isInteger(trainerId)) {
    return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!isSuperadminRole(user.role) && body && typeof body === "object" && ("billingModel" in body || "rate" in body)) {
    return NextResponse.json({ error: "Stawkę i model rozliczenia zmienia tylko superadmin." }, { status: 403 });
  }
  const parsed = trainerSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
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
  await logAdminAction(user, { action: "trenerka_edytowana", entityType: "trainer", entityId: trainerId, details: { fields: Object.keys(d) } });
  revalidateTag(CACHE_TAGS.courses);
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
  await logAdminAction(user, { action: "trenerka_dezaktywowana", entityType: "trainer", entityId: trainerId });
  revalidateTag(CACHE_TAGS.courses);
  return NextResponse.json({ ok: true });
}
