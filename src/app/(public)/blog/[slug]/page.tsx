import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { articleJsonLd } from "@/lib/seo";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";
import { IconClock } from "@/components/icons";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

async function getPost(slug: string) {
  const db = await getDb();
  const rows = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.slug, slug)).limit(1);
  const post = rows[0];
  if (!post || post.status !== "opublikowane") return null;
  return post;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Nie znaleziono artykułu" };
  return {
    title: post.metaTitle || `${post.title}`,
    description: post.metaDescription || post.excerpt.slice(0, 160),
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt.slice(0, 200),
      url: `/blog/${post.slug}`,
      type: "article",
      images: post.imageUrl ? [{ url: post.imageUrl, alt: post.title }] : [],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const html = renderMarkdown(post.content);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <JsonLd data={articleJsonLd(post)} />
      <Breadcrumbs
        items={[
          { name: "Strona główna", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: post.title, url: `/blog/${post.slug}` },
        ]}
      />

      <span className="badge-tag mt-6 inline-flex">{post.category}</span>
      <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">{post.title}</h1>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="font-semibold text-ink-soft">{post.author}</span>
        <span aria-hidden>·</span>
        <span>{formatDate(post.publishedAt)}</span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <IconClock width={14} height={14} /> {post.readingMinutes} min czytania
        </span>
      </p>

      {post.imageUrl && (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-[12px] bg-sand-100">
          <Image src={post.imageUrl} alt={post.title} fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        </div>
      )}

      <div className="prose-ub mt-8" dangerouslySetInnerHTML={{ __html: html }} />

      {/* CTA końcowe */}
      <aside className="card mt-12 bg-cream-warm p-8 text-center">
        <h2 className="font-serif text-2xl font-bold">Gotowa na start w beauty?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Sprawdź certyfikowane szkolenia z dofinansowaniem do 90% — pomożemy Ci przejść przez cały proces.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/kursy" className="btn-primary">Przeglądaj kursy</Link>
          <Link href="/konsultacja" className="btn-outline">Bezpłatna konsultacja</Link>
        </div>
      </aside>
    </article>
  );
}
