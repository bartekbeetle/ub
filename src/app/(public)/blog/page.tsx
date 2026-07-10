import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { formatDate } from "@/lib/utils";
import { BLOG_CATEGORIES, SITE_NAME } from "@/lib/constants";
import { IconClock } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Blog — porady i trendy beauty`,
  description:
    "Porady, trendy i inspiracje dla przyszłych profesjonalistek branży beauty. Dofinansowania, kariera, techniki PMU, stylizacja rzęs i paznokci.",
  alternates: { canonical: "/blog" },
};

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function BlogPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const kat = typeof sp.kategoria === "string" && (BLOG_CATEGORIES as readonly string[]).includes(sp.kategoria) ? sp.kategoria : "";

  const db = await getDb();
  const conditions: SQL[] = [eq(schema.blogPosts.status, "opublikowane")];
  if (q) conditions.push(ilike(schema.blogPosts.title, `%${q}%`));
  if (kat) conditions.push(eq(schema.blogPosts.category, kat));

  const posts = await db
    .select()
    .from(schema.blogPosts)
    .where(and(...conditions))
    .orderBy(desc(schema.blogPosts.publishedAt));

  const [featured, ...rest] = posts;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Blog", url: "/blog" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Blog Uniwersytet Beauty</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Porady, trendy i inspiracje dla przyszłych profesjonalistek branży beauty.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_280px]">
        <div>
          {/* FEATURED POST */}
          {featured && !q && !kat && (
            <article className="card grid overflow-hidden md:grid-cols-2">
              <Link href={`/blog/${featured.slug}`} className="relative block aspect-[16/10] bg-sand-100 md:aspect-auto md:min-h-[280px]">
                {featured.imageUrl && (
                  <Image src={featured.imageUrl} alt={featured.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                )}
              </Link>
              <div className="flex flex-col justify-center gap-3 p-6 md:p-8">
                <span className="badge-tag self-start">{featured.category}</span>
                <h2 className="font-serif text-2xl font-bold leading-snug">
                  <Link href={`/blog/${featured.slug}`} className="hover:text-sand-700 transition-colors">
                    {featured.title}
                  </Link>
                </h2>
                <p className="text-muted">{featured.excerpt.slice(0, 180)}{featured.excerpt.length > 180 ? "…" : ""}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="font-semibold text-ink-soft">{featured.author}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDate(featured.publishedAt)}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1"><IconClock width={14} height={14} /> {featured.readingMinutes} min czytania</span>
                </p>
              </div>
            </article>
          )}

          {/* SIATKA */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {(q || kat ? posts : rest).map((post) => (
              <article key={post.id} className="card flex flex-col overflow-hidden">
                <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/10] bg-sand-100">
                  {post.imageUrl && (
                    <Image src={post.imageUrl} alt={post.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                  )}
                </Link>
                <div className="flex flex-1 flex-col gap-2.5 p-5">
                  <span className="badge-tag self-start">{post.category}</span>
                  <h2 className="font-serif text-lg font-semibold leading-snug">
                    <Link href={`/blog/${post.slug}`} className="hover:text-sand-700 transition-colors">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted">{post.excerpt.slice(0, 110)}…</p>
                  <p className="mt-auto pt-2 text-xs text-muted">
                    {formatDate(post.publishedAt)} · {post.readingMinutes} min czytania
                  </p>
                </div>
              </article>
            ))}
          </div>

          {posts.length === 0 && (
            <div className="card p-10 text-center">
              <p className="text-muted">Brak artykułów dla podanych kryteriów.</p>
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-6">
          <form method="GET" action="/blog" className="card p-5">
            <label className="label" htmlFor="blog-q">Szukaj artykułów</label>
            <input id="blog-q" type="search" name="q" defaultValue={q} placeholder="np. dofinansowanie" className="input" />
            <button type="submit" className="btn-primary mt-3 w-full !py-2.5 !text-sm">Szukaj</button>
          </form>
          <nav className="card p-5" aria-label="Kategorie bloga">
            <p className="label">Kategorie</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/blog" className={`badge-tag transition-colors hover:bg-sand-200 ${!kat ? "!bg-sand-400 !text-white" : ""}`}>
                Wszystkie
              </Link>
              {BLOG_CATEGORIES.map((c) => (
                <Link
                  key={c}
                  href={`/blog?kategoria=${encodeURIComponent(c)}`}
                  className={`badge-tag transition-colors hover:bg-sand-200 ${kat === c ? "!bg-sand-400 !text-white" : ""}`}
                >
                  {c}
                </Link>
              ))}
            </div>
          </nav>
        </aside>
      </div>
    </div>
  );
}
