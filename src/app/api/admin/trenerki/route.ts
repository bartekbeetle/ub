import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { trainerSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const db = await getDb();
  return NextResponse.json(await db.select().from(schema.trainers).orderBy(desc(schema.trainers.createdAt)));
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const parsed = trainerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  const db = await getDb();
  const d = parsed.data;
  try {
    const [created] = await db
      .insert(schema.trainers)
      .values({
        ...d,
        email: d.email || null,
        phone: d.phone || null,
        bio: d.bio || null,
        city: d.city || null,
        voivodeship: d.voivodeship || null,
        avatarUrl: d.avatarUrl || null,
        coverUrl: d.coverUrl || null,
        instagram: d.instagram || null,
        facebook: d.facebook || null,
        website: d.website || null,
      })
      .returning();
    await logAudit({ actor: actorLabel(user), action: "trenerka_utworzona", entityType: "trainer", entityId: created.id });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Slug już istnieje albo dane są nieprawidłowe." }, { status: 409 });
  }
}
