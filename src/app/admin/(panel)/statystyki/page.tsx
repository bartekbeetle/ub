import Link from "next/link";
import { redirect } from "next/navigation";
import { and, gte, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { voivodeshipName, LEAD_STATUS_LABELS } from "@/lib/constants";
import { KANAL_LABELS, kanalLeada } from "@/lib/lead-channel";
import { messageAge, messageHeardFrom, messageWorksInBeauty } from "@/lib/lead-message";

/**
 * Statystyki kursantek (10.10.2026). Wszystko liczone w pamięci z jednego zapytania o leady —
 * leadów są setki, nie miliony. Wykresy to czyste HTML/CSS (bez biblioteki): poziome słupki
 * do rankingów, kolumny do trendu tygodniowego. Jeden kolor marki (sand-600, 3,3:1 na białym),
 * liczby zawsze tekstem obok słupka, podpowiedź `title` po najechaniu.
 */

const OKRESY = {
  "30": { label: "30 dni", days: 30 },
  "90": { label: "90 dni", days: 90 },
  "365": { label: "12 miesięcy", days: 365 },
  wszystko: { label: "Od początku", days: null },
} as const;
type OkresKey = keyof typeof OKRESY;

/** Kolejność przedziałów jak w quizie (AGE_OPTIONS w src/lib/quiz-form.ts). */
const AGE_ORDER = ["18–24", "25–34", "35–44", "45–54", "55+"];
const DNI = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];

type Row = { label: string; value: number; note?: string };

function countBy<T>(items: T[], key: (t: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

const sorted = (m: Map<string, number>): Row[] =>
  [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

/** „  gdańsk ” i „Gdańsk” to to samo miasto. */
function normCity(raw: string | null): string | null {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return null;
  return s
    .toLocaleLowerCase("pl-PL")
    .split(/([\s-])/)
    .map((p) => (p.length > 1 ? p[0].toLocaleUpperCase("pl-PL") + p.slice(1) : p))
    .join("");
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function BarList({ title, rows, total, empty, foot }: { title: string; rows: Row[]; total: number; empty?: string; foot?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="card p-5">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty ?? "Brak danych w tym okresie."}</p>
      ) : (
        <ul data-reveal className="mt-4 space-y-1.5">
          {rows.map((r, i) => (
            <li
              key={r.label}
              title={`${r.label}: ${r.value} (${pct(r.value, total)}%)${r.note ? ` · ${r.note}` : ""}`}
              className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 rounded-md px-1 py-1 text-sm hover:bg-sand-50"
            >
              <span className="truncate text-ink-soft">{r.label}</span>
              <span className="anim-bar-x h-2.5 rounded-r-[4px] bg-sand-600" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, ["--i" as string]: i }} />
              <span className="whitespace-nowrap text-right tabular-nums text-ink-soft">
                <strong>{r.value}</strong> <span className="text-xs text-muted">{pct(r.value, total)}%</span>
                {r.note && <span className="ml-2 text-xs text-money-dark">{r.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {foot && <p className="mt-3 text-xs text-muted">{foot}</p>}
    </section>
  );
}

function Weekly({ weeks }: { weeks: { label: string; value: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.value));
  return (
    <section className="card p-5">
      <h2 className="font-serif text-lg font-semibold">Leady tygodniowo</h2>
      <div data-reveal className="mt-4 flex h-40 items-end gap-1 border-b border-gray-200" role="list">
        {weeks.map((w, i) => (
          <div
            key={w.label}
            role="listitem"
            title={`tydzień od ${w.label}: ${w.value}`}
            className="group flex h-full flex-1 flex-col items-center justify-end"
          >
            <span className="mb-1 text-[11px] tabular-nums text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100">{w.value}</span>
            <span className="anim-bar-y w-full max-w-[28px] rounded-t-[4px] bg-sand-600" style={{ height: `${(w.value / max) * 100}%`, minHeight: w.value ? 3 : 0, ["--i" as string]: i }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {weeks.map((w, i) => (
          <span key={w.label} className="flex-1 text-center text-[10px] text-muted">
            {i % 2 === 0 || weeks.length <= 8 ? w.label : ""}
          </span>
        ))}
      </div>
    </section>
  );
}

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function StatystykiPage({ searchParams }: { searchParams: Search }) {
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.role)) redirect("/admin/login");

  const sp = await searchParams;
  const okres: OkresKey = (typeof sp.okres === "string" && sp.okres in OKRESY ? sp.okres : "wszystko") as OkresKey;
  const days = OKRESY[okres].days;
  const since = days ? new Date(Date.now() - days * 864e5) : null;

  const db = await getDb();
  const leads = await db
    .select({
      createdAt: schema.leads.createdAt,
      city: schema.leads.city,
      voivodeship: schema.leads.voivodeship,
      category: schema.leads.category,
      extraCategories: schema.leads.extraCategories,
      employmentStatus: schema.leads.employmentStatus,
      hasBusinessActivity: schema.leads.hasBusinessActivity,
      status: schema.leads.status,
      source: schema.leads.source,
      message: schema.leads.message,
      utmSource: schema.leads.utmSource,
      contactConsentAt: schema.leads.contactConsentAt,
    })
    .from(schema.leads)
    .where(and(isNull(schema.leads.anonymizedAt), since ? gte(schema.leads.createdAt, since) : undefined));

  const total = leads.length;
  const zapisane = leads.filter((l) => l.status === "zapisana" || l.status === "rozliczony").length;
  const odrzucone = leads.filter((l) => l.status === "odrzucony").length;
  const zTelefonem = leads.filter((l) => l.contactConsentAt).length;

  // Miasta: liczba leadów + ile z nich zapisanych (to jest „działa”, nie samo zgłoszenie).
  const cityMap = countBy(leads, (l) => normCity(l.city));
  const cityZap = countBy(
    leads.filter((l) => l.status === "zapisana" || l.status === "rozliczony"),
    (l) => normCity(l.city)
  );
  const cities = sorted(cityMap)
    .slice(0, 15)
    .map((r) => ({ ...r, note: cityZap.get(r.label) ? `${cityZap.get(r.label)} zapis.` : undefined }));
  const bezMiasta = leads.filter((l) => !normCity(l.city)).length;

  const voivs = sorted(countBy(leads, (l) => voivodeshipName(l.voivodeship)));

  const extraCount = countBy(leads.flatMap((l) => l.extraCategories.map((c) => ({ c }))), (x) => x.c);
  const cats = sorted(countBy(leads, (l) => l.category)).map((r) => ({
    ...r,
    note: extraCount.get(r.label) ? `+${extraCount.get(r.label)} jako dodatkowa` : undefined,
  }));

  const ageMap = countBy(leads, (l) => messageAge(l.message));
  const ages: Row[] = AGE_ORDER.filter((a) => ageMap.has(a)).map((a) => ({ label: a, value: ageMap.get(a)! }));
  const bezWieku = total - ages.reduce((s, r) => s + r.value, 0);

  const employment = sorted(countBy(leads, (l) => l.employmentStatus));
  const firma = sorted(
    countBy(leads, (l) => (l.hasBusinessActivity === true ? "Ma firmę" : l.hasBusinessActivity === false ? "Bez firmy" : null))
  );
  const beauty = sorted(countBy(leads, (l) => messageWorksInBeauty(l.message))).map((r) => ({
    ...r,
    label: r.label === "tak" ? "Pracuje w beauty" : r.label === "nie" ? "Nie pracuje w beauty" : r.label,
  }));
  const heard = sorted(countBy(leads, (l) => messageHeardFrom(l.message)));
  const kanal = sorted(
    countBy(leads, (l) => {
      const k = kanalLeada(l);
      return k ? KANAL_LABELS[k] : l.source === "quiz" ? "Aplikacja" : `Inne (${l.source})`;
    })
  );
  const utm = sorted(countBy(leads, (l) => l.utmSource?.trim() || "bez UTM (wejście bezpośrednie / organiczne)")).slice(0, 10);
  const statusy = sorted(countBy(leads, (l) => LEAD_STATUS_LABELS[l.status] ?? l.status));
  const dzien = DNI.map((d, i) => ({
    label: d,
    value: leads.filter((l) => (l.createdAt.getDay() + 6) % 7 === i).length,
  }));

  // Trend: tygodnie od poniedziałku, ostatnie 16 (albo cały okres, jeśli krótszy).
  const monday = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  };
  const nWeeks = days ? Math.min(16, Math.ceil(days / 7)) : 16;
  const thisMon = monday(new Date());
  const weeks = Array.from({ length: nWeeks }, (_, i) => {
    const start = new Date(thisMon);
    start.setDate(start.getDate() - (nWeeks - 1 - i) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      label: start.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }),
      value: leads.filter((l) => l.createdAt >= start && l.createdAt < end).length,
    };
  });

  const tile = (label: string, value: string | number, hint?: string) => (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl font-bold text-ink-soft tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Statystyki kursantek</h1>
          <p className="mt-1 text-sm text-muted">
            Skąd przychodzą, kim są i co je interesuje. Najedź na słupek, żeby zobaczyć liczbę i udział.
          </p>
        </div>
        <nav className="inline-flex gap-1 rounded-full border border-sand-600 bg-white p-1" aria-label="Okres">
          {(Object.keys(OKRESY) as OkresKey[]).map((k) => (
            <Link
              key={k}
              href={k === "wszystko" ? "/admin/statystyki" : `/admin/statystyki?okres=${k}`}
              aria-current={okres === k ? "true" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${okres === k ? "bg-sand-700 text-white" : "text-sand-700 hover:bg-sand-50"}`}
            >
              {OKRESY[k].label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tile("Leady", total, OKRESY[okres].label.toLowerCase())}
        {tile("Zapisane", zapisane, `${pct(zapisane, total)}% konwersji`)}
        {tile("Zgoda na telefon", `${pct(zTelefonem, total)}%`, `${zTelefonem} z ${total}`)}
        {tile("Odrzucone", odrzucone, `${pct(odrzucone, total)}%`)}
      </div>

      <div className="mt-6">
        <Weekly weeks={weeks} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <BarList
          title="Miasta — top 15"
          rows={cities}
          total={total}
          empty="Kursantki nie podały miasta."
          foot={`Bez podanego miasta: ${bezMiasta}. Zielona liczba = zapisane z tego miasta.`}
        />
        <BarList title="Województwa" rows={voivs} total={total} />
        <BarList
          title="Wiek"
          rows={ages}
          total={total}
          empty="Brak odpowiedzi o wiek."
          foot={`Bez odpowiedzi o wiek: ${bezWieku} (starsze formularze i wejścia spoza aplikacji).`}
        />
        <BarList
          title="Kategorie (główna)"
          rows={cats}
          total={total}
          foot="Zielona liczba = ile razy kategoria wystąpiła jako dodatkowa."
        />
        <BarList title="Status zawodowy" rows={employment} total={total} />
        <BarList title="Własna firma" rows={firma} total={total} empty="Brak odpowiedzi." />
        <BarList title="Praca w beauty" rows={beauty} total={total} empty="Brak odpowiedzi." />
        <BarList title="Skąd wie o nas" rows={heard} total={total} empty="Brak odpowiedzi." />
        <BarList title="Kanał zgłoszenia" rows={kanal} total={total} />
        <BarList title="Źródło ruchu (UTM) — top 10" rows={utm} total={total} />
        <BarList title="Status leada" rows={statusy} total={total} />
        <BarList title="Dzień tygodnia zgłoszenia" rows={dzien} total={total} />
      </div>
    </div>
  );
}
