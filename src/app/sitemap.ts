import type { MetadataRoute } from "next";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Strony formalne (regulamin, polityka prywatności, polityka cookies) dostały 28.07.2026
// `robots: noindex, follow` (audyt on-page) — boilerplate prawny bez wartości rankingowej.
// Sitemapa nie powinna promować URL-i oznaczonych noindex (mieszany sygnał dla Google),
// dlatego nie ma tu już osobnej listy LEGAL_PAGES.
//
// `/trenerki` i profile `/trenerka/[slug]` NIE są tu od 13.09.2026 — decyzja właściciela
// o chowaniu trenerek przed startem kampanii, obie trasy przekierowują 308 na /kursy,
// a promowanie ich w sitemapie wysyłałoby Google mieszany sygnał (redirect + sitemap razem).
// `/quiz` jest w sitemapie mimo `robots: noindex` na stronie — Google i tak jej nie zaindeksuje
// (noindex wygrywa), a obecność w sitemapie nie szkodzi; zostaje więc dla porządku listy tras.
// `/quiz` USUNIĘTY z sitemapy 14.09: ma `robots: noindex`, więc zgłaszanie go Google
// było sprzecznością, którą Search Console raportuje jako „Strona z noindex w mapie witryny".
// `/poradnik` wchodzi — to realna treść pod frazy o dofinansowaniu, indeksowalna.
const MAIN_PAGES = ["", "/kursy", "/dofinansowania", "/blog", "/kontakt", "/konsultacja", "/poradnik", "/o-nas"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();
  const [courses, posts, combos] = await Promise.all([
    db
      .select({ slug: schema.courses.slug, createdAt: schema.courses.createdAt })
      .from(schema.courses)
      .where(eq(schema.courses.status, "opublikowane")),
    db
      .select({ slug: schema.blogPosts.slug, publishedAt: schema.blogPosts.publishedAt, createdAt: schema.blogPosts.createdAt })
      .from(schema.blogPosts)
      .where(eq(schema.blogPosts.status, "opublikowane")),
    // Programmatic SEO: do sitemapy trafiają tylko te kombinacje kategoria × województwo,
    // które mają realny kurs — puste listy to thin content i strata crawl budgetu.
    db
      .select({ category: schema.courses.category, voivodeship: schema.courses.voivodeship })
      .from(schema.courses)
      .where(eq(schema.courses.status, "opublikowane"))
      .groupBy(schema.courses.category, schema.courses.voivodeship)
      .having(sql`count(*) > 0`),
  ]);

  const now = new Date();

  const comboUrls = combos.flatMap(({ category, voivodeship }) => {
    const base = `${SITE_URL}/kursy?kategoria=${encodeURIComponent(category)}`;
    const urls = [base];
    // Sitemapa to XML: surowy `&` w <loc> to błąd składni, który unieważnia CAŁY plik
    // (28.07.2026: Google raportował „Błąd analizy składni, wiersz 232" i 0 wykrytych stron).
    // Next 15 nie escapuje `&` za nas, więc encodujemy encję ręcznie.
    if (voivodeship) urls.push(`${base}&amp;wojewodztwo=${encodeURIComponent(voivodeship)}`);
    return urls.map((url) => ({ url, lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 }));
  });

  return [
    ...MAIN_PAGES.map((p) => ({
      url: SITE_URL + (p || "/"),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.8,
    })),
    ...courses.map((c) => ({
      url: `${SITE_URL}/kurs/${c.slug}`,
      lastModified: c.createdAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.publishedAt ?? p.createdAt ?? now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...Array.from(new Map(comboUrls.map((c) => [c.url, c])).values()),
  ];
}
