import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { BlogForm } from "@/components/admin/BlogForm";

export const dynamic = "force-dynamic";

export default async function EdycjaPostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();
  const db = await getDb();
  const [post] = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.id, postId)).limit(1);
  if (!post) notFound();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Edytuj: {post.title}</h1>
      <div className="card mt-6 p-6">
        <BlogForm post={post} />
      </div>
    </div>
  );
}
