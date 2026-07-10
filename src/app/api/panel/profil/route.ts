import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireTrainer } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";

// Trenerka edytuje TYLKO pola kontaktowe/prezentacyjne.
// billingModel / rate / leadLimitMonthly / isActive / specializations ustala wyłącznie admin.
const profileSchema = z.object({
  bio: z.string().max(8000).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  instagram: z.string().trim().max(300).optional().or(z.literal("")),
  facebook: z.string().trim().max(300).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const user = await requireTrainer();
  if (!user || !user.trainerId) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  const d = parsed.data;

  const db = await getDb();
  await db
    .update(schema.trainers)
    .set({
      bio: d.bio || null,
      phone: d.phone || null,
      instagram: d.instagram || null,
      facebook: d.facebook || null,
      website: d.website || null,
      avatarUrl: d.avatarUrl || null,
    })
    .where(eq(schema.trainers.id, user.trainerId));

  await logAudit({ actor: actorLabel(user), action: "edycja_profilu", entityType: "trainer", entityId: user.trainerId });
  return NextResponse.json({ ok: true });
}
