import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { courseSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const db = await getDb();
  return NextResponse.json(await db.select().from(schema.courses).orderBy(desc(schema.courses.createdAt)));
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const parsed = courseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  const db = await getDb();
  const d = parsed.data;
  try {
    const [created] = await db
      .insert(schema.courses)
      .values({
        ...d,
        shortDescription: d.shortDescription || null,
        description: d.description || null,
        forWhom: d.forWhom || null,
        nextDate: d.nextDate || null,
        city: d.city || null,
        voivodeship: d.voivodeship || null,
        imageUrl: d.imageUrl || null,
        trainerId: d.trainerId ?? null,
      })
      .returning();
    await logAudit({ actor: actorLabel(user), action: "szkolenie_utworzone", entityType: "course", entityId: created.id });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Slug już istnieje albo dane są nieprawidłowe." }, { status: 409 });
  }
}
