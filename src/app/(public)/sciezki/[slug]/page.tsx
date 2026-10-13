import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedCoursesWithTrainers } from "@/lib/public-cache";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { itemListJsonLd, metaDescription, pageTitle } from "@/lib/seo";
import { getSciezka } from "@/lib/sciezki";
import { SUBSIDY_RANGE } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const sciezka = getSciezka(slug);
  if (!sciezka) return {};
  const canonical = `/sciezki/${sciezka.slug}`;
  return {
    title: pageTitle(`${sciezka.naglowek} — dofinansowanie ${SUBSIDY_RANGE}`),
    description: metaDescription(
      `${sciezka.lead} Kursy ze wsparciem w zdobyciu dofinansowania BUR ${SUBSIDY_RANGE}.`
    ),
    alternates: { canonical },
    // Podgląd: ścieżki nie są jeszcze zatwierdzone do publikacji — zdejmujemy po decyzji Bartka.
    robots: { index: false, follow: false },
  };
}

export default async function SciezkaPage({ params }: { params: Params }) {
  const { slug } = await params;
  const sciezka = getSciezka(slug);
  if (!sciezka) notFound();

  const rows = await getPublishedCoursesWithTrainers();
  const bySlug = new Map(rows.map((r) => [r.course.slug, r.course]));

  // Krok bez żadnego opublikowanego kursu znika — nie pokazujemy pustych kroków.
  const kroki = sciezka.kroki
    .map((k) => ({ ...k, kursy: k.kursy.map((s) => bySlug.get(s)).filter((c): c is NonNullable<typeof c> => !!c) }))
    .filter((k) => k.kursy.length > 0);

  const wszystkie = kroki.flatMap((k) => k.kursy);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <JsonLd data={itemListJsonLd(sciezka.naglowek, wszystkie.map((c) => ({ name: c.title, url: `/kurs/${c.slug}` })))} />
      <Breadcrumbs
        items={[
          { name: "Strona główna", url: "/" },
          { name: "Ścieżki kariery", url: `/sciezki/${sciezka.slug}` },
          { name: sciezka.nazwa, url: `/sciezki/${sciezka.slug}` },
        ]}
      />

      <header className="mt-4">
        <span className="badge-money">Dofinansowanie {SUBSIDY_RANGE}</span>
        <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">{sciezka.naglowek}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">{sciezka.lead}</p>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Nie musisz przechodzić wszystkich kroków. Wybierz ten, który pasuje do tego, co już umiesz, a o dofinansowanie
          każdego szkolenia zadbamy razem z Tobą.
        </p>
      </header>

      {kroki.length === 0 ? (
        <p className="mt-10 text-muted">
          Szkolenia z tej ścieżki pojawią się wkrótce.{" "}
          <Link href={`/kursy?kategoria=${encodeURIComponent(sciezka.kategoria)}`} className="underline">
            Zobacz wszystkie kursy w tej kategorii
          </Link>
          .
        </p>
      ) : (
        <ol className="mt-10 space-y-10">
          {kroki.map((krok, i) => (
            <li key={krok.tytul} className="grid gap-4 md:grid-cols-[72px_1fr]">
              <div className="flex items-center gap-3 md:flex-col md:items-start">
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sand-700 text-lg font-bold text-white"
                >
                  {i + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted md:hidden">Krok {i + 1}</span>
              </div>

              <div>
                <p className="hidden text-xs font-semibold uppercase tracking-wide text-muted md:block">Krok {i + 1}</p>
                <h2 className="text-2xl font-bold">{krok.tytul}</h2>
                <p className="mt-2 text-muted">{krok.wprowadzenie}</p>
                {krok.kursy.length > 1 && (
                  <p className="mt-1 text-sm font-semibold text-ink-soft">Do wyboru:</p>
                )}

                <ul className="mt-4 space-y-3">
                  {krok.kursy.map((c) => (
                    <li key={c.slug} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-serif text-lg font-semibold leading-snug">
                          <Link href={`/kurs/${c.slug}`} className="transition-colors hover:text-sand-700">
                            {c.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-sm text-muted">{c.shortDescription}</p>
                      </div>
                      <Link href={`/aplikacja?kurs=${c.slug}`} className="btn-primary shrink-0 !py-2.5 !text-sm">
                        Aplikuj o dofinansowanie
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      )}

      <aside className="card mt-14 p-6 text-center">
        <h2 className="text-xl font-bold">Nie wiesz, od którego kroku zacząć?</h2>
        <p className="mt-2 text-muted">Powiedz nam, co już umiesz — dobierzemy szkolenie i sprawdzimy dofinansowanie.</p>
        <Link href="/konsultacja" className="btn-primary mt-4 inline-flex">
          Umów bezpłatną konsultację
        </Link>
      </aside>
    </div>
  );
}
