import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { isSuperadminRole, stripBilling } from "@/lib/roles";
import { logAdminAction } from "@/lib/audit";
import { trainerSchema } from "@/lib/validators";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/public-cache";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const db = await getDb();
  const all = await db.select().from(schema.trainers).orderBy(desc(schema.trainers.createdAt));
  // Stawki i model rozliczenia widzi tylko superadmin.
  return NextResponse.json(isSuperadminRole(user.role) ? all : all.map(({ rate: _r, billingModel: _b, ...rest }) => rest));
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const body = await req.json().catch(() => null);
  // Model rozliczenia i stawka to warunki finansowe — ustawia je tylko superadmin.
  if (!isSuperadminRole(user.role) && body && typeof body === "object" && ("billingModel" in body || "rate" in body)) {
    return NextResponse.json({ error: "Stawkę i model rozliczenia ustawia tylko superadmin." }, { status: 403 });
  }
  const parsed = trainerSchema.safeParse(body);
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
    await logAdminAction(user, { action: "trenerka_utworzona", entityType: "trainer", entityId: created.id });
    revalidateTag(CACHE_TAGS.courses);
    return NextResponse.json(stripBilling(created, user.role), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Slug już istnieje albo dane są nieprawidłowe." }, { status: 409 });
  }
}
