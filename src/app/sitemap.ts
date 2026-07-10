import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();
  const [courses, trainers, posts] = await Promise.all([
    db.select({ slug: schema.courses.slug }).from(schema.courses).where(eq(schema.courses.status, "opublikowane")),
    db.select({ slug: schema.trainers.slug }).from(schema.trainers).where(eq(schema.trainers.isActive, true)),
    db.select({ slug: schema.blogPosts.slug }).from(schema.blogPosts).where(eq(schema.blogPosts.status, "opublikowane")),
  ]);

  const staticPages = ["", "/kursy", "/trenerki", "/dofinansowania", "/blog", "/kontakt", "/konsultacja", "/o-nas", "/regulamin", "/polityka-prywatnosci", "/polityka-cookies"];

  return [
    ...staticPages.map((p) => ({
      url: SITE_URL + (p || "/"),
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.7,
    })),
    ...courses.map((c) => ({ url: `${SITE_URL}/kurs/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...trainers.map((t) => ({ url: `${SITE_URL}/trenerka/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
