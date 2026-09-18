import { unstable_cache } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Cache warstwy danych dla stron publicznych.
 *
 * Strony publiczne zostają force-dynamic (build w Dockerze nie ma DATABASE_URL —
 * prerender przy buildzie trafiłby w pusty PGlite), ale dane spod nich są cache'owane:
 * jedna lista na encję, filtrowanie w pamięci na stronie. Kursów i wpisów jest
 * kilkanaście, więc pamięciowy filtr jest tańszy niż osobny wpis cache per kombinacja
 * parametrów — a wolny tekst z wyszukiwarki (?q=) w ogóle nie tworzy kluczy cache.
 *
 * Inwalidacja: revalidateTag w adminowych trasach zapisu (blog/szkolenia/trenerki)
 * + TTL 300 s jako siatka bezpieczeństwa, gdyby jakiś zapis ominął tagi.
 *
 * Uwaga: wynik przechodzi przez serializację JSON, więc kolumny timestamp wracają
 * jako stringi. formatDate/JSON-LD są na to odporne (przyjmują Date | string);
 * nie wolno na tych wierszach wołać metod Date bez opakowania w new Date().
 */

export const CACHE_TAGS = {
  courses: "public-courses",
  blog: "public-blog",
} as const;

const REVALIDATE_SECONDS = 300;

/** Opublikowane kursy z trenerkami, najnowsze pierwsze. */
export const getPublishedCoursesWithTrainers = unstable_cache(
  async () => {
    const db = await getDb();
    return db
      .select({ course: schema.courses, trainer: schema.trainers })
      .from(schema.courses)
      .leftJoin(schema.trainers, eq(schema.courses.trainerId, schema.trainers.id))
      .where(eq(schema.courses.status, "opublikowane"))
      .orderBy(desc(schema.courses.createdAt));
  },
  ["public-courses-with-trainers"],
  { tags: [CACHE_TAGS.courses], revalidate: REVALIDATE_SECONDS }
);

/** Opublikowane wpisy bloga, najnowsze pierwsze. */
export const getPublishedPosts = unstable_cache(
  async () => {
    const db = await getDb();
    return db
      .select()
      .from(schema.blogPosts)
      .where(eq(schema.blogPosts.status, "opublikowane"))
      .orderBy(desc(schema.blogPosts.publishedAt));
  },
  ["public-blog-posts"],
  { tags: [CACHE_TAGS.blog], revalidate: REVALIDATE_SECONDS }
);
