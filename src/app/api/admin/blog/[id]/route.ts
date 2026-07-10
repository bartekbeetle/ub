import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { blogPostSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const postId = Number(id);
  const parsed = blogPostSchema.partial().safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(postId) || !parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const db = await getDb();
  const [existing] = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.id, postId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  const publishedAt =
    parsed.data.status === "opublikowane" && !existing.publishedAt ? new Date() : existing.publishedAt;

  const [updated] = await db
    .update(schema.blogPosts)
    .set({ ...parsed.data, publishedAt })
    .where(eq(schema.blogPosts.id, postId))
    .returning();
  await logAudit({ actor: actorLabel(user), action: "post_edytowany", entityType: "blogPost", entityId: postId });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });
  const db = await getDb();
  const deleted = await db.delete(schema.blogPosts).where(eq(schema.blogPosts.id, postId)).returning();
  if (!deleted[0]) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  await logAudit({ actor: actorLabel(user), action: "post_usuniety", entityType: "blogPost", entityId: postId });
  return NextResponse.json({ ok: true });
}
