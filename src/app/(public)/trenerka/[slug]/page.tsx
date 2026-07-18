import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { StarRating } from "@/components/StarRating";
import { CourseCard } from "@/components/CourseCard";
import { personJsonLd } from "@/lib/seo";
import { voivodeshipName, SITE_NAME } from "@/lib/constants";
import { IconPin, IconUsers, IconStar, IconAward, IconInstagram, IconFacebook, IconGlobe } from "@/components/icons";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

async function getTrainer(slug: string) {
  const db = await getDb();
  const rows = await db.select().from(schema.trainers).where(eq(schema.trainers.slug, slug)).limit(1);
  const trainer = rows[0];
  if (!trainer || !trainer.isActive) return null;
  return trainer;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const trainer = await getTrainer(slug);
  if (!trainer) return { title: "Nie znaleziono trenerki" };
  const title = `${trainer.name} — trenerka ${trainer.specializations[0] ?? "beauty"}${trainer.city ? `, ${trainer.city}` : ""}`;
  return {
    title: `${title}`,
    description: trainer.bio?.slice(0, 160) ?? title,
    alternates: { canonical: `/trenerka/${trainer.slug}` },
    openGraph: { title, description: trainer.bio?.slice(0, 200) ?? "", url: `/trenerka/${trainer.slug}` },
  };
}

export default async function TrenerkaPage({ params }: { params: Params }) {
  const { slug } = await params;
  const trainer = await getTrainer(slug);
  if (!trainer) notFound();

  const db = await getDb();
  const [reviews, courses] = await Promise.all([
    db.select().from(schema.reviews).where(eq(schema.reviews.trainerId, trainer.id)).orderBy(desc(schema.reviews.createdAt)).limit(6),
    db
      .select({ course: schema.courses })
      .from(schema.courses)
      .where(and(eq(schema.courses.trainerId, trainer.id), eq(schema.courses.status, "opublikowane")))
      .orderBy(desc(schema.courses.createdAt)),
  ]);

  const socials = [
    { href: trainer.instagram, label: `Instagram trenerki ${trainer.name}`, Icon: IconInstagram },
    { href: trainer.facebook, label: `Facebook trenerki ${trainer.name}`, Icon: IconFacebook },
    { href: trainer.website, label: `Strona www trenerki ${trainer.name}`, Icon: IconGlobe },
  ].filter((s) => s.href);

  return (
    <div>
      <JsonLd data={personJsonLd(trainer)} />

      {/* COVER BANNER */}
      <div className="relative h-48 bg-gradient-to-r from-sand-300 via-sand-200 to-sand-100 md:h-64">
        {trainer.coverUrl && (
          <Image src={trainer.coverUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-soft/30 to-transparent" aria-hidden />
      </div>

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="-mt-14 md:-mt-16">
          <TrainerAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} size={120} className="ring-4 ring-cream" />
        </div>

        <div className="mt-4">
          <Breadcrumbs
            items={[
              { name: "Strona główna", url: "/" },
              { name: "Trenerki", url: "/trenerki" },
              { name: trainer.name, url: `/trenerka/${trainer.slug}` },
            ]}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">{trainer.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {trainer.specializations.map((s) => (
                <Link key={s} href={`/kursy?kategoria=${encodeURIComponent(s)}`} className="badge-tag hover:bg-sand-200 transition-colors">
                  {s}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <StarRating rating={trainer.rating} reviewCount={trainer.reviewCount} />
              {trainer.studentsCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <IconUsers width={16} height={16} /> {trainer.studentsCount} przeszkolonych osób
                </span>
              )}
              {trainer.city && (
                <span className="inline-flex items-center gap-1.5">
                  <IconPin width={16} height={16} /> {trainer.city}, {voivodeshipName(trainer.voivodeship)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {socials.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-sand-100 text-sand-700 transition-colors hover:bg-sand-200"
              >
                <Icon />
              </a>
            ))}
            <Link href="/kontakt" className="btn-primary !px-6 !py-3 !text-sm">Skontaktuj się</Link>
          </div>
        </div>

        <div className="mt-10 grid gap-10 pb-16 lg:grid-cols-[1fr_400px]">
          <div className="space-y-10">
            {trainer.bio && (
              <section aria-labelledby="omnie-h">
                <h2 id="omnie-h" className="text-2xl font-bold">O mnie</h2>
                <p className="prose-ub mt-4 whitespace-pre-line">{trainer.bio}</p>
              </section>
            )}

            {trainer.certificates.length > 0 && (
              <section aria-labelledby="cert-h">
                <h2 id="cert-h" className="text-2xl font-bold">Certyfikaty i osiągnięcia</h2>
                <div className="mt-4 space-y-3">
                  {trainer.certificates.map((c, i) => (
                    <div key={i} className="card flex items-start gap-4 p-5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sand-700">
                        <IconAward width={20} height={20} />
                      </span>
                      <div>
                        <p className="font-semibold text-ink-soft">{c.title}</p>
                        {c.description && <p className="mt-0.5 text-sm text-muted">{c.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* OPINIE */}
          <aside aria-labelledby="opinie-h">
            <h2 id="opinie-h" className="text-2xl font-bold">Opinie</h2>
            {trainer.reviewCount > 0 && (
              <div className="card mt-4 flex items-center gap-4 p-5">
                <p className="font-serif text-4xl font-bold text-ink-soft">
                  {(trainer.rating / 10).toFixed(1).replace(".", ",")}
                </p>
                <div>
                  <div className="flex gap-0.5 text-gold" aria-label={`Ocena ${(trainer.rating / 10).toFixed(1)} na 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <IconStar key={i} width={16} height={16} className={i < Math.round(trainer.rating / 10) ? "text-gold" : "text-sand-200"} />
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-muted">{trainer.reviewCount} opinii w Google</p>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-4">
              {reviews.map((r) => (
                <article key={r.id} className="card p-5">
                  <div className="flex items-center gap-3">
                    <TrainerAvatar name={r.authorName} size={36} />
                    <div>
                      <p className="text-sm font-semibold text-ink-soft">{r.authorName}</p>
                      <div className="flex gap-0.5" aria-label={`Ocena ${r.rating} na 5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <IconStar key={i} width={12} height={12} className={i < r.rating ? "text-gold" : "text-sand-200"} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink">{r.content}</p>
                  {r.courseTitle && <p className="mt-2 text-xs font-semibold text-sand-700">{r.courseTitle}</p>}
                </article>
              ))}
            </div>
          </aside>
        </div>

        {courses.length > 0 && (
          <section className="border-t border-sand-100 pb-16 pt-12" aria-labelledby="szkolenia-trenerki-h">
            <h2 id="szkolenia-trenerki-h" className="text-2xl font-bold md:text-3xl">Szkolenia tej trenerki</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map(({ course }) => (
                <CourseCard key={course.id} course={course} trainer={trainer} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
