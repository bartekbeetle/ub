import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BlogAdminPage() {
  const db = await getDb();
  const posts = await db.select().from(schema.blogPosts).orderBy(desc(schema.blogPosts.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Blog <span className="text-base font-normal text-muted">({posts.length})</span></h1>
        <Link href="/admin/blog/nowy" className="btn-primary !px-4 !py-2 !text-sm">+ Nowy post</Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Tytuł</th>
              <th className="px-4 py-3 font-semibold">Kategoria</th>
              <th className="px-4 py-3 font-semibold">Data publikacji</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="max-w-md px-4 py-3 font-semibold">{p.title}</td>
                <td className="px-4 py-3"><span className="badge-tag">{p.category}</span></td>
                <td className="px-4 py-3 text-muted">{formatDate(p.publishedAt)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.status === "opublikowane" ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs font-semibold">
                    <Link href={`/admin/blog/${p.id}`} className="text-sand-700 hover:underline">Edytuj</Link>
                    {p.status === "opublikowane" && (
                      <a href={`/blog/${p.slug}`} target="_blank" className="text-muted hover:underline">Podgląd →</a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
