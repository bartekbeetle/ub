import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

/**
 * Blog jako content-as-files: artykuły to pliki markdown w content/blog/*.md
 * (kopie źródeł z vault: Marketing/wpisy). Frontmatter YAML + treść markdown.
 *
 * Idempotentny upsert po slugu. Nowy wpis = wrzuć plik .md do content/blog/
 * i odpal: npm run db:seed-blog
 * Skrypt kasuje też poglądowe posty demo (DEPRECATED_SLUGS) ze scripts/seed.ts.
 *
 * Lokalnie (DATABASE_URL puste) leci na PGlite (./.pglite), na prod na Postgres.
 */

const BLOG_DIR = join(process.cwd(), "content", "blog");

// Poglądowe posty demo (scripts/seed.ts) zastąpione realnymi artykułami SEO.
// Kasujemy je po slugu przy każdym odpaleniu — idempotentnie, lokalnie i na prod.
const DEPRECATED_SLUGS = [
  "jak-zdobyc-dofinansowanie-na-szkolenie-beauty-przewodnik",
  "ile-zarabia-linergistka-w-polsce",
  "bur-nie-tylko-dla-bezrobotnych-5-mitow",
  "microblading-czy-ombre-brows-co-wybrac",
  "przebranzowienie-na-beauty-po-30-od-czego-zaczac",
  "trendy-beauty-2026-jakie-uslugi-beda-zarabiac",
];

// Obraz nagłówkowy dobierany po slugu (pliki w /public/images).
function pickImage(slug: string): string {
  if (slug.includes("pmu") || slug.includes("rzes") || slug.includes("brwi")) return "/images/pmu-brwi.jpg";
  if (slug.includes("region") || slug.includes("slaskie") || slug.includes("mazowieckie")) return "/images/medycyna-estetyczna.jpg";
  return "/images/akademia-sala.jpg";
}

type ParsedPost = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  metaTitle: string;
  metaDescription: string;
  author: string;
  readingMinutes: number;
  status: "opublikowane" | "szkic";
  publishedAt: Date;
};

/** Wczytuje wszystkie artykuły z content/blog/*.md, parsuje frontmatter, tnie H1. */
function loadPosts(): ParsedPost[] {
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  const posts: ParsedPost[] = [];
  for (const file of files) {
    const raw = readFileSync(join(BLOG_DIR, file), "utf8");
    const { data, content } = matter(raw);
    const slug = String(data.slug || "").trim();
    if (!slug) {
      console.warn(`⚠ pomijam ${file} — brak pola slug w frontmatter`);
      continue;
    }
    // Wytnij pierwszy nagłówek H1 (title renderuje strona osobno).
    const body = content.replace(/^\s*#\s+.*(\r?\n)+/, "").trim();
    posts.push({
      slug,
      title: String(data.title || "").trim(),
      category: String(data.category || "Dofinansowania").trim(),
      excerpt: String(data.excerpt || "").trim(),
      content: body,
      imageUrl: pickImage(slug),
      metaTitle: String(data.metaTitle || data.title || "").trim(),
      metaDescription: String(data.metaDescription || data.meta_description || "").trim(),
      author: "Redakcja Uniwersytet Beauty",
      readingMinutes: Number(data.reading_minutes || 6),
      status: "opublikowane",
      publishedAt: data.data ? new Date(data.data as string) : new Date(),
    });
  }
  return posts;
}

async function getDb() {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== "") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const schema = await import("../src/db/schema");
    const pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 15000,
      statement_timeout: 30000,
    });
    return { db: drizzle(pool, { schema }), close: () => pool.end(), schema };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const schema = await import("../src/db/schema");
  const client = new PGlite("./.pglite");
  return { db: drizzle(client, { schema }), close: () => client.close(), schema };
}

async function main() {
  const { db, close, schema } = await getDb();
  const { blogPosts } = schema;
  const { sql, inArray } = await import("drizzle-orm");

  if (DEPRECATED_SLUGS.length > 0) {
    await db.delete(blogPosts).where(inArray(blogPosts.slug, DEPRECATED_SLUGS));
    console.log(`✓ usunięto poglądowe posty: ${DEPRECATED_SLUGS.length}`);
  }

  const POSTS = loadPosts();
  for (const p of POSTS) {
    await db
      .insert(blogPosts)
      .values(p)
      .onConflictDoUpdate({
        target: blogPosts.slug,
        set: {
          title: p.title,
          category: p.category,
          excerpt: p.excerpt,
          content: p.content,
          imageUrl: p.imageUrl,
          metaTitle: p.metaTitle,
          metaDescription: p.metaDescription,
          author: p.author,
          readingMinutes: p.readingMinutes,
          status: p.status,
          publishedAt: p.publishedAt,
        },
      });
    console.log(`✓ upsert: ${p.slug}`);
  }

  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(blogPosts);
  console.log(`\nBaza bloga: ${c} postów łącznie (wgrano ${POSTS.length} z plików).`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
