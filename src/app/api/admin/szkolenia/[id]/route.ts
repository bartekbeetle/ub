import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { courseSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const courseId = Number(id);
  const parsed = courseSchema.partial().safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(courseId) || !parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const db = await getDb();
  const [updated] = await db
    .update(schema.courses)
    .set(parsed.data)
    .where(eq(schema.courses.id, courseId))
    .returning();
  if (!updated) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  await logAudit({ actor: actorLabel(user), action: "szkolenie_edytowane", entityType: "course", entityId: courseId });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });
  const db = await getDb();
  const [updated] = await db
    .update(schema.courses)
    .set({ status: "szkic" })
    .where(eq(schema.courses.id, courseId))
    .returning();
  if (!updated) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  await logAudit({ actor: actorLabel(user), action: "szkolenie_wycofane", entityType: "course", entityId: courseId });
  return NextResponse.json({ ok: true });
}
