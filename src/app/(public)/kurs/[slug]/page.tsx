import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublishedCoursesWithTrainers } from "@/lib/public-cache";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { TrackEvent } from "@/components/TrackEvent";
import { courseJsonLd, courseMetaDescription, pageTitle } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { voivodeshipName, SITE_NAME } from "@/lib/constants";
import { IconPin, IconClock, IconCheck, IconCalendar } from "@/components/icons";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

async function getCourse(slug: string) {
  // Lista jest cache'owana i zawiera tylko opublikowane — patrz public-cache.ts.
  const rows = await getPublishedCoursesWithTrainers();
  return rows.find((r) => r.course.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const row = await getCourse(slug);
  if (!row) return { title: "Nie znaleziono kursu" };
  const { course, trainer } = row;
  // Tytuł budowany kaskadowo: pełny → bez miasta → bez sufiksu o dofinansowaniu.
  // Bez tego tytuły kursów dochodziły do 91 znaków i Google ucinał je w połowie frazy.
  const subsidy = ` z dofinansowaniem do ${course.subsidyPercent}%`;
  const candidates = [
    `${course.title}${course.city ? ` ${course.city}` : ""}${subsidy}`,
    `${course.title}${subsidy}`,
    course.title,
  ];
  const title = candidates.find((c) => c.length <= 60) ?? course.title;
  const description = courseMetaDescription(course, trainer?.name);
  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: `/kurs/${course.slug}` },
    openGraph: {
      title,
      description,
      url: `/kurs/${course.slug}`,
      type: "website",
      locale: "pl_PL",
      siteName: SITE_NAME,
      images: course.imageUrl ? [{ url: course.imageUrl, width: 1600, height: 1600, alt: course.title }] : [],
    },
  };
}

/**
 * Opisy kursów ogólnych (seed `db:seed-kursy-ogolne`) używają lekkiego markdownu: akapit
 * złożony wyłącznie z `**...**` jest śródtytułem, a `**...**` w środku zdania — pogrubieniem.
 * Wcześniej akapity leciały surowo przez `<p>{p}</p>`, więc na stronie kursu wyświetlały się
 * dosłownie gwiazdki („**Jak wygląda kurs**"). Złapane w QA 13.09 przed startem kampanii.
 *
 * Świadomie NIE wciągam tu biblioteki markdown: opisy są nasze i mają dokładnie te dwa wzorce,
 * a mniej zależności na ścieżce strony docelowej reklam to mniej rzeczy, które mogą paść.
 * Tekst trafia do Reacta jako zwykłe dzieci elementów, więc nie ma `dangerouslySetInnerHTML`.
 */
function renderOpis(opis: string) {
  const pogrub = (linia: string, klucz: number) => {
    const czesci = linia.split(/\*\*(.+?)\*\*/g);
    return (
      <p key={klucz}>
        {czesci.map((c, i) => (i % 2 === 1 ? <strong key={i}>{c}</strong> : c))}
      </p>
    );
  };

  return opis.split("\n\n").map((akapit, i) => {
    const t = akapit.trim();
    const srodtytul = t.match(/^\*\*(.+)\*\*$/);
    if (srodtytul) {
      return (
        <h3 key={i} className="mt-6 text-lg font-semibold">
          {srodtytul[1]}
        </h3>
      );
    }
    return pogrub(t, i);
  });
}

export default async function KursPage({ params }: { params: Params }) {
  const { slug } = await params;
  const row = await getCourse(slug);
  if (!row) notFound();
  const { course, trainer } = row;

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
                {renderOpis(course.description)}
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

        {/* STICKY BOX REZERWACJI — bez cen: decyzja właściciela 13.09.2026, cały ruch
            ma iść przez quiz kwalifikacyjny, nie przez samoobsługową transakcję. */}
        <aside>
          <div className="card space-y-5 p-6 lg:sticky lg:top-24">
            <div>
              <p className="badge-money !text-sm">Dofinansowanie do {course.subsidyPercent}%</p>
              <p className="mt-2 text-lg font-semibold text-ink-soft">
                Sprawdź, ile zapłacisz po dofinansowaniu
              </p>
            </div>

            {course.nextDate && (
              <p className="flex items-center gap-2 text-sm text-ink">
                <IconCalendar width={17} height={17} className="text-sand-700" />
                Najbliższy termin: <strong>{formatDate(course.nextDate)}</strong>
              </p>
            )}

            {/* Licznik miejsc pokazujemy TYLKO gdy ktoś realnie zajął miejsce. „10/10 wolnych"
                to negatywny social proof — komunikuje „nikt się jeszcze nie zapisał"
                (spotkanie zespołu 13.09, głos Growth). Wraca sam, gdy pojawią się zapisy. */}
            {course.takenSpots > 0 && (
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
            )}

            <Link href={`/aplikacja?kurs=${course.slug}`} className="btn-primary w-full">Aplikuj o dofinansowanie</Link>

            <ul className="space-y-2.5 border-t border-sand-100 pt-4 text-sm">
              {["Certyfikowany kurs", "Bezpieczne dofinansowanie", "Gwarancja jakości"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-ink">
                  <IconCheck width={16} height={16} className="text-money" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
