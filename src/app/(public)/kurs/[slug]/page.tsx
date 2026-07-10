import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { StarRating } from "@/components/StarRating";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { LeadFormModal } from "@/components/LeadFormModal";
import { TrackEvent } from "@/components/TrackEvent";
import { courseJsonLd } from "@/lib/seo";
import { formatPln, formatDate } from "@/lib/utils";
import { voivodeshipName, SITE_NAME } from "@/lib/constants";
import { IconPin, IconClock, IconCheck, IconCalendar } from "@/components/icons";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

async function getCourse(slug: string) {
  const db = await getDb();
  const rows = await db
    .select({ course: schema.courses, trainer: schema.trainers })
    .from(schema.courses)
    .leftJoin(schema.trainers, eq(schema.courses.trainerId, schema.trainers.id))
    .where(eq(schema.courses.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row || row.course.status !== "opublikowane") return null;
  return row;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const row = await getCourse(slug);
  if (!row) return { title: "Nie znaleziono kursu" };
  const { course } = row;
  const title = `${course.title}${course.city ? ` ${course.city}` : ""} z dofinansowaniem do ${course.subsidyPercent}%`;
  return {
    title: `${title}`,
    description: course.shortDescription ?? title,
    alternates: { canonical: `/kurs/${course.slug}` },
    openGraph: {
      title,
      description: course.shortDescription ?? "",
      url: `/kurs/${course.slug}`,
      type: "website",
      images: course.imageUrl ? [{ url: course.imageUrl, width: 1600, height: 1600, alt: course.title }] : [],
    },
  };
}

export default async function KursPage({ params }: { params: Params }) {
  const { slug } = await params;
  const row = await getCourse(slug);
  if (!row) notFound();
  const { course, trainer } = row;

  const priceAfter = Math.round(course.price * (1 - course.subsidyPercent / 100));
  const savings = course.price - priceAfter;
  const freeSpots = Math.max(0, course.totalSpots - course.takenSpots);
  const spotsPct = Math.round((freeSpots / course.totalSpots) * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <JsonLd data={courseJsonLd(course, trainer?.name)} />
      <TrackEvent event="ViewContent" params={{ content_name: course.title, content_category: course.category, value: course.price, currency: "PLN" }} />
      <Breadcrumbs
        items={[
          { name: "Strona główna", url: "/" },
          { name: "Kursy", url: "/kursy" },
          { name: course.title, url: `/kurs/${course.slug}` },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="badge-tag">{course.category}</span>
        <span className="badge-tag">{course.level}</span>
        <span className="badge-tag">{course.mode}</span>
        <span className="badge-money">Dofinansowanie {course.subsidyPercent}%</span>
      </div>

      <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight md:text-4xl">{course.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
        {trainer && <StarRating rating={trainer.rating} reviewCount={trainer.reviewCount} />}
        {course.city && (
          <span className="inline-flex items-center gap-1.5">
            <IconPin width={16} height={16} /> {course.city}, {voivodeshipName(course.voivodeship)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <IconClock width={16} height={16} /> {course.durationHours} godzin
        </span>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        {/* TREŚĆ */}
        <div>
          {course.imageUrl && (
            <div className="relative aspect-[16/9] overflow-hidden rounded-[12px] bg-sand-100">
              <Image
                src={course.imageUrl}
                alt={course.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
            </div>
          )}

          {course.description && (
            <section className="mt-8" aria-labelledby="opis-h">
              <h2 id="opis-h" className="text-2xl font-bold">O szkoleniu</h2>
              <div className="prose-ub mt-4">
                {course.description.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}

          {course.program.length > 0 && (
            <section className="mt-10" aria-labelledby="program-h">
              <h2 id="program-h" className="text-2xl font-bold">Program szkolenia</h2>
              <ol className="mt-4 space-y-3">
                {course.program.map((item, i) => (
                  <li key={i} className="card flex items-start gap-4 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sand-100 font-serif text-sm font-bold text-sand-700">
                      {i + 1}
                    </span>
                    <span className="pt-1 text-ink">{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {course.includes.length > 0 && (
            <section className="mt-10" aria-labelledby="cena-zawiera-h">
              <h2 id="cena-zawiera-h" className="text-2xl font-bold">Co zawiera cena</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.includes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <IconCheck width={18} height={18} className="mt-0.5 shrink-0 text-money" />
                    <span className="text-ink">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {course.forWhom && (
            <section className="mt-10" aria-labelledby="dla-kogo-h">
              <h2 id="dla-kogo-h" className="text-2xl font-bold">Dla kogo jest ten kurs</h2>
              <p className="prose-ub mt-4">{course.forWhom}</p>
            </section>
          )}
        </div>

        {/* STICKY BOX REZERWACJI */}
        <aside>
          <div className="card space-y-5 p-6 lg:sticky lg:top-24">
            <div>
              <p className="text-base text-muted line-through">{formatPln(course.price)}</p>
              <p className="text-4xl font-bold text-money">
                {priceAfter === 0 ? "Od 0 zł" : `Od ${formatPln(priceAfter)}`}
              </p>
              {savings > 0 && (
                <p className="mt-1 text-sm font-semibold text-money-dark">
                  Oszczędzasz do {formatPln(savings)} z dofinansowaniem
                </p>
              )}
            </div>

            {course.nextDate && (
              <p className="flex items-center gap-2 text-sm text-ink">
                <IconCalendar width={17} height={17} className="text-sand-700" />
                Najbliższy termin: <strong>{formatDate(course.nextDate)}</strong>
              </p>
            )}

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Dostępne miejsca</span>
                <span className="font-bold text-ink-soft">
                  {freeSpots}/{course.totalSpots}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sand-100" role="progressbar" aria-valuenow={freeSpots} aria-valuemin={0} aria-valuemax={course.totalSpots} aria-label="Dostępne miejsca">
                <div className="h-full rounded-full bg-sand-400 transition-all duration-300" style={{ width: `${spotsPct}%` }} />
              </div>
            </div>

            <LeadFormModal courseId={course.id} category={course.category} voivodeship={course.voivodeship} />
            <Link href="/kontakt" className="btn-outline w-full">Zapytaj o szczegóły</Link>

            <ul className="space-y-2.5 border-t border-sand-100 pt-4 text-sm">
              {["Certyfikowany kurs", "Bezpieczne dofinansowanie", "Gwarancja jakości"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-ink">
                  <IconCheck width={16} height={16} className="text-money" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* MINI-KARTA TRENERKI */}
          {trainer && (
            <div className="card mt-5 flex items-center gap-4 p-5">
              <TrainerAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} size={56} />
              <div className="min-w-0">
                <p className="truncate font-serif text-base font-semibold">{trainer.name}</p>
                <StarRating rating={trainer.rating} reviewCount={trainer.reviewCount} />
                <Link href={`/trenerka/${trainer.slug}`} className="text-sm font-semibold text-sand-700 hover:text-sand-500 transition-colors">
                  Zobacz profil →
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
