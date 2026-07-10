import type { Metadata } from "next";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CourseCard } from "@/components/CourseCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CATEGORIES, LEVELS, MODES, VOIVODESHIPS, voivodeshipName, SITE_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Search = { [key: string]: string | string[] | undefined };

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const sp = await searchParams;
  const woj = typeof sp.wojewodztwo === "string" ? voivodeshipName(sp.wojewodztwo) : "";
  const kat = asArray(sp.kategoria)[0] ?? "";
  // programmatic SEO: unikalny title dla kombinacji filtrów
  let title = "Kursy i szkolenia beauty z dofinansowaniem do 100%";
  if (kat && woj) title = `Kurs ${kat} ${woj} z dofinansowaniem do 100%`;
  else if (kat) title = `Kurs ${kat} z dofinansowaniem do 100%`;
  else if (woj) title = `Kursy beauty ${woj} z dofinansowaniem do 100%`;
  const qs = new URLSearchParams();
  if (typeof sp.wojewodztwo === "string" && sp.wojewodztwo) qs.set("wojewodztwo", sp.wojewodztwo);
  if (kat) qs.set("kategoria", kat);
  const canonical = "/kursy" + (qs.size ? `?${qs.toString()}` : "");
  return {
    title: `${title}`,
    description: `${title}. Certyfikowane trenerki, wsparcie w zdobyciu dofinansowania BUR, realne umiejętności od pierwszego dnia.`,
    alternates: { canonical },
    openGraph: { title, url: canonical },
  };
}

export default async function KursyPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const woj = typeof sp.wojewodztwo === "string" ? sp.wojewodztwo : "";
  const kategorie = asArray(sp.kategoria).filter((k) => (CATEGORIES as readonly string[]).includes(k));
  const tryb = typeof sp.tryb === "string" && (MODES as readonly string[]).includes(sp.tryb) ? sp.tryb : "";
  const poziomy = asArray(sp.poziom).filter((p) => (LEVELS as readonly string[]).includes(p));

  const db = await getDb();
  const conditions: SQL[] = [eq(schema.courses.status, "opublikowane")];
  if (woj) conditions.push(eq(schema.courses.voivodeship, woj));
  if (kategorie.length) {
    conditions.push(or(...kategorie.map((k) => eq(schema.courses.category, k)))!);
  }
  if (tryb) conditions.push(eq(schema.courses.mode, tryb));
  if (poziomy.length) {
    conditions.push(or(...poziomy.map((p) => eq(schema.courses.level, p)))!);
  }
  if (q) {
    conditions.push(
      or(ilike(schema.courses.title, `%${q}%`), ilike(schema.trainers.name, `%${q}%`))!
    );
  }

  const rows = await db
    .select({ course: schema.courses, trainer: schema.trainers })
    .from(schema.courses)
    .leftJoin(schema.trainers, eq(schema.courses.trainerId, schema.trainers.id))
    .where(and(...conditions))
    .orderBy(desc(schema.courses.createdAt));

  const wojName = voivodeshipName(woj);
  const heading =
    kategorie.length === 1 && wojName
      ? `Kursy: ${kategorie[0]} — ${wojName}`
      : kategorie.length === 1
        ? `Kursy: ${kategorie[0]}`
        : wojName
          ? `Kursy i szkolenia — ${wojName}`
          : "Kursy i szkolenia";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Kursy", url: "/kursy" }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">{heading}</h1>
          <p className="mt-2 text-muted">
            Znaleziono <strong className="text-ink-soft">{rows.length}</strong>{" "}
            {rows.length === 1 ? "szkolenie" : rows.length < 5 && rows.length > 0 ? "szkolenia" : "szkoleń"} z
            dofinansowaniem BUR
          </p>
        </div>
        <p className="text-sm text-muted">Sortowanie: <span className="font-semibold text-ink-soft">Trafność</span></p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* SIDEBAR FILTRÓW — form GET, filtry w URL (indeksowalne) */}
        <aside aria-label="Filtry">
          <form method="GET" action="/kursy" className="card space-y-6 p-5 lg:sticky lg:top-24">
            <div>
              <label className="label" htmlFor="f-q">Szukaj</label>
              <input id="f-q" type="search" name="q" defaultValue={q} placeholder="Nazwa kursu lub trenerka" className="input" />
            </div>

            <div>
              <label className="label" htmlFor="f-woj">Województwo</label>
              <select id="f-woj" name="wojewodztwo" defaultValue={woj} className="input">
                <option value="">Wszystkie</option>
                {VOIVODESHIPS.map((v) => (
                  <option key={v.slug} value={v.slug}>{v.name}</option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className="label">Kategoria</legend>
              <div className="space-y-2">
                {CATEGORIES.map((c) => (
                  <label key={c} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="kategoria"
                      value={c}
                      defaultChecked={kategorie.includes(c)}
                      className="h-4 w-4 accent-sand-500"
                    />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="label" htmlFor="f-tryb">Tryb kursu</label>
              <select id="f-tryb" name="tryb" defaultValue={tryb} className="input">
                <option value="">Wszystkie</option>
                {MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className="label">Poziom</legend>
              <div className="space-y-2">
                {LEVELS.map((l) => (
                  <label key={l} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="poziom"
                      value={l}
                      defaultChecked={poziomy.includes(l)}
                      className="h-4 w-4 accent-sand-500"
                    />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1 !py-2.5 !text-sm">Filtruj</button>
              <a href="/kursy" className="btn-outline flex-1 !py-2.5 !text-sm">Wyczyść</a>
            </div>
          </form>
        </aside>

        {/* WYNIKI */}
        <section aria-label="Lista kursów">
          {rows.length === 0 ? (
            <div className="card p-10 text-center">
              <h2 className="font-serif text-xl font-semibold">Brak kursów dla wybranych filtrów</h2>
              <p className="mt-2 text-muted">
                Zmień kryteria wyszukiwania albo <a href="/konsultacja" className="font-semibold text-sand-700 underline">napisz do nas</a> — pomożemy znaleźć szkolenie w Twojej okolicy.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {rows.map(({ course, trainer }) => (
                <CourseCard key={course.id} course={course} trainer={trainer} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
