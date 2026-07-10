import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { blogPostSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const db = await getDb();
  return NextResponse.json(await db.select().from(schema.blogPosts).orderBy(desc(schema.blogPosts.createdAt)));
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const parsed = blogPostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  const db = await getDb();
  const d = parsed.data;
  try {
    const [created] = await db
      .insert(schema.blogPosts)
      .values({
        ...d,
        imageUrl: d.imageUrl || null,
        metaTitle: d.metaTitle || null,
        metaDescription: d.metaDescription || null,
        publishedAt: d.status === "opublikowane" ? new Date() : null,
      })
      .returning();
    await logAudit({ actor: actorLabel(user), action: "post_utworzony", entityType: "blogPost", entityId: created.id });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Slug już istnieje." }, { status: 409 });
  }
}
