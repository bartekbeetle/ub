import Link from "next/link";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { formatDate } from "@/lib/utils";
import { callQueueCondition, getCallQueue, warsawCalendarDaysDiff } from "@/lib/prospects";
import {
  BUR_SEGMENTS,
  BUR_SEGMENT_COLORS,
  BUR_SEGMENT_LABELS,
  BUR_SEGMENT_SHORT,
  CATEGORIES,
  PROSPECT_PIPELINE_ORDER,
  PROSPECT_PRIORITIES,
  PROSPECT_PRIORITY_COLORS,
  PROSPECT_PRIORITY_LABELS,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  VOIVODESHIPS,
  voivodeshipName,
} from "@/lib/constants";
import { ProspectStatusSelect } from "@/components/admin/ProspectStatusSelect";
import { ProspectQuickActions } from "@/components/admin/ProspectQuickActions";

export const dynamic = "force-dynamic";

/** "nigdy" / "dzisiaj" / "wczoraj" / "N dni temu" — dla kolumny „ostatni kontakt". */
function lastContactLabel(lastContactAt: Date | null): string {
  if (!lastContactAt) return "nigdy";
  const days = warsawCalendarDaysDiff(lastContactAt);
  if (days <= 0) return "dzisiaj";
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}

/** `tel:` chce samych cyfr i ewentualnego `+` — numery w bazie bywają wpisane ze spacjami. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

const SORTS = {
  ostatnie: { label: "Ostatnio ruszone", column: desc(schema.prospects.updatedAt) },
  dodane: { label: "Ostatnio dodane", column: desc(schema.prospects.createdAt) },
  nazwa: { label: "Nazwa A→Z", column: asc(schema.prospects.name) },
  bur: { label: "Najwięcej usług w BUR", column: desc(schema.prospects.burServicesCompleted) },
} as const;

export default async function CrmTrenerkiPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const status = (PROSPECT_STATUSES as readonly string[]).includes(str("status")) ? str("status") : "";
  const segment = (BUR_SEGMENTS as readonly string[]).includes(str("bur")) ? str("bur") : "";
  const woj = VOIVODESHIPS.some((v) => v.slug === str("wojewodztwo")) ? str("wojewodztwo") : "";
  const kategoria = (CATEGORIES as readonly string[]).includes(str("kategoria")) ? str("kategoria") : "";
  const priorytet = (PROSPECT_PRIORITIES as readonly string[]).includes(str("priorytet")) ? str("priorytet") : "";
  const sortKey = (str("sort") in SORTS ? str("sort") : "ostatnie") as keyof typeof SORTS;
  const widokDzis = str("widok") === "dzis";

  const db = await getDb();
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(schema.prospects.status, status as (typeof PROSPECT_STATUSES)[number]));
  if (segment) conditions.push(eq(schema.prospects.burSegment, segment as (typeof BUR_SEGMENTS)[number]));
  if (woj) conditions.push(eq(schema.prospects.voivodeship, woj));
  if (priorytet) conditions.push(eq(schema.prospects.priority, priorytet as (typeof PROSPECT_PRIORITIES)[number]));
  if (kategoria) conditions.push(sql`${schema.prospects.categories} @> ${JSON.stringify([kategoria])}::jsonb`);
  // `?widok=dzis` zawęża tabelę do DOKŁADNIE tego samego zbioru co blok „Do zadzwonienia" —
  // AND-owane z resztą filtrów, żeby dało się np. połączyć z wybranym województwem.
  if (widokDzis) conditions.push(callQueueCondition());

  const [prospects, counts, callQueue] = await Promise.all([
    db
      .select()
      .from(schema.prospects)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(SORTS[sortKey].column)
      .limit(300),
    db
      .select({ status: schema.prospects.status, c: sql<number>`count(*)::int` })
      .from(schema.prospects)
      .groupBy(schema.prospects.status),
    getCallQueue(25),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status as string, c.c]));
  const total = counts.reduce((sum, c) => sum + c.c, 0);
  const segmentA = prospects.filter((p) => p.burSegment === "A").length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">
            CRM trenerki <span className="text-base font-normal text-muted">({prospects.length} z {total})</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pipeline pozyskiwania akademii i trenerek jako klientów B2B. Publiczny katalog jest osobno —
            profil powstaje dopiero po podpisaniu umowy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/crm-trenerki/nowy" className="btn-primary !px-4 !py-2 !text-sm">+ Dodaj prospekta</Link>
        </div>
      </div>

      {/* ☎️ DO ZADZWONIENIA — zaległe/dzisiejsze terminy + rozmowy zaczęte i porzucone bez ustalonego kroku */}
      {callQueue.total === 0 ? (
        <p className="mt-6 text-sm text-muted">Nic nie czeka na telefon.</p>
      ) : (
        <div className="card mt-6 overflow-hidden border-2 border-sand-300">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 bg-sand-50 px-4 py-3">
            <h2 className="font-serif text-lg font-semibold">
              ☎️ Do zadzwonienia{" "}
              <span className="text-sm font-normal text-muted">
                ({callQueue.rows.length} z {callQueue.total})
              </span>
            </h2>
            <Link href="/admin/crm-trenerki?widok=dzis" className="text-xs font-semibold text-sand-700 hover:underline">
              Pokaż w pełnej tabeli →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Podmiot</th>
                  <th className="px-4 py-3 font-semibold">Kontakt</th>
                  <th className="px-4 py-3 font-semibold">BUR</th>
                  <th className="px-4 py-3 font-semibold">Następny ruch</th>
                  <th className="px-4 py-3 font-semibold">Szybka akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {callQueue.rows.map((p) => {
                  const overdueDays = p.nextActionAt ? warsawCalendarDaysDiff(p.nextActionAt) : 0;
                  return (
                    <tr key={p.id} className="align-top hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/crm-trenerki/${p.id}`} className="font-semibold text-sand-700 hover:underline">
                          {p.name}
                        </Link>
                        {/* Akademia, która sama założyła konto, dzwoni się inaczej niż kontakt
                            z researchu: zna ofertę, zostawiła dane dobrowolnie i CZEKA na telefon.
                            Dlatego wyróżniamy ją w kolejce, zamiast chować w kolumnie „źródło". */}
                        {p.source === "rejestracja" && (
                          <span className="mt-1 inline-flex rounded-full bg-money-bg px-2 py-0.5 text-xs font-bold text-money-dark">
                            zgłosiła się sama
                          </span>
                        )}
                        <p className="text-xs text-muted">
                          {p.city ?? "—"}
                          {p.voivodeship ? `, ${voivodeshipName(p.voivodeship)}` : ""}
                        </p>
                        <p className="max-w-[200px] text-xs text-muted">{p.categories.join(", ") || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        {p.phone ? (
                          <a href={telHref(p.phone)} className="font-semibold text-sand-700 hover:underline">
                            {p.phone}
                          </a>
                        ) : (
                          <span className="text-muted">brak numeru</span>
                        )}
                        <p className="text-xs text-muted">ostatni kontakt: {lastContactLabel(p.lastContactAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${BUR_SEGMENT_COLORS[p.burSegment]}`}>
                          {BUR_SEGMENT_SHORT[p.burSegment]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.nextActionAt ? (
                          <p className={overdueDays > 0 ? "font-semibold text-red-700" : "text-ink-soft"}>
                            {formatDate(p.nextActionAt)}
                            {overdueDays > 0 && <span className="block text-xs">zaległe o {overdueDays} dni</span>}
                          </p>
                        ) : (
                          <p className="text-muted">brak terminu — status „{PROSPECT_STATUS_LABELS[p.status]}"</p>
                        )}
                        {p.nextActionNote && <p className="mt-1 max-w-[220px] text-xs text-muted">{p.nextActionNote}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <ProspectQuickActions prospectId={p.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LICZNIKI LEJKA */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {PROSPECT_PIPELINE_ORDER.map((s) => {
          const active = status === s;
          return (
            <Link
              key={s}
              href={active ? "/admin/crm-trenerki" : `/admin/crm-trenerki?status=${s}`}
              aria-current={active ? "true" : undefined}
              className={`card p-4 transition-colors ${active ? "ring-2 ring-sand-600" : ""}`}
            >
              <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-bold ${PROSPECT_STATUS_COLORS[s]}`}>
                {PROSPECT_STATUS_LABELS[s]}
              </span>
              <p className="mt-2 font-serif text-2xl font-bold text-ink-soft">{countByStatus.get(s) ?? 0}</p>
            </Link>
          );
        })}
      </div>

      {/* FILTRY */}
      <form method="GET" className="card mt-5 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <select name="status" defaultValue={status} className="input !py-2 !text-sm" aria-label="Status">
          <option value="">Status: wszystkie</option>
          {PROSPECT_STATUSES.map((s) => <option key={s} value={s}>{PROSPECT_STATUS_LABELS[s]}</option>)}
        </select>
        <select name="bur" defaultValue={segment} className="input !py-2 !text-sm" aria-label="Segment BUR">
          <option value="">BUR: wszystkie</option>
          {BUR_SEGMENTS.map((s) => <option key={s} value={s}>{BUR_SEGMENT_LABELS[s]}</option>)}
        </select>
        <select name="wojewodztwo" defaultValue={woj} className="input !py-2 !text-sm" aria-label="Województwo">
          <option value="">Woj.: wszystkie</option>
          {VOIVODESHIPS.map((v) => <option key={v.slug} value={v.slug}>{v.name}</option>)}
        </select>
        <select name="kategoria" defaultValue={kategoria} className="input !py-2 !text-sm" aria-label="Kategoria">
          <option value="">Kategoria: wszystkie</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="priorytet" defaultValue={priorytet} className="input !py-2 !text-sm" aria-label="Priorytet">
          <option value="">Priorytet: wszystkie</option>
          {PROSPECT_PRIORITIES.map((p) => <option key={p} value={p}>{PROSPECT_PRIORITY_LABELS[p]}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="sort" defaultValue={sortKey} className="input !py-2 !text-sm" aria-label="Sortowanie">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button type="submit" className="btn-primary !px-4 !py-2 !text-sm">OK</button>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft sm:col-span-3 lg:col-span-6">
          <input type="checkbox" name="widok" value="dzis" defaultChecked={widokDzis} className="h-4 w-4 rounded border-gray-300" />
          Tylko dziś do zadzwonienia (ten sam zbiór co blok „Do zadzwonienia" powyżej)
        </label>
      </form>

      {segmentA > 0 && (
        <p className="mt-3 text-sm text-muted">
          W tym widoku <strong className="text-money-dark">{segmentA}</strong> podmiotów z segmentu A — tylko one mogą
          dziś przyjąć kursantkę z dofinansowaniem.
        </p>
      )}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Podmiot</th>
              <th className="px-4 py-3 font-semibold">Lokalizacja</th>
              <th className="px-4 py-3 font-semibold">Kategorie</th>
              <th className="px-4 py-3 font-semibold">BUR</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Priorytet</th>
              <th className="px-4 py-3 font-semibold">Ruch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {prospects.map((p) => (
              <tr key={p.id} className={`align-top hover:bg-gray-50 ${p.burSegment === "A" ? "bg-money-bg/40" : ""}`}>
                <td className="px-4 py-3">
                  <Link href={`/admin/crm-trenerki/${p.id}`} className="font-semibold text-sand-700 hover:underline">
                    {p.name}
                  </Link>
                  {p.source === "rejestracja" && (
                    <span className="ml-2 inline-flex rounded-full bg-money-bg px-2 py-0.5 text-xs font-bold text-money-dark">
                      zgłosiła się sama
                    </span>
                  )}
                  <p className="text-xs text-muted">{p.phone ?? p.email ?? "brak kontaktu"}</p>
                </td>
                <td className="px-4 py-3">
                  {p.city ?? "—"}
                  {p.voivodeship ? <span className="block text-xs text-muted">{voivodeshipName(p.voivodeship)}</span> : null}
                </td>
                <td className="max-w-[220px] px-4 py-3 text-xs">{p.categories.join(", ") || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${BUR_SEGMENT_COLORS[p.burSegment]}`}>
                    {BUR_SEGMENT_SHORT[p.burSegment]}
                  </span>
                  {p.burSegment === "A" && (
                    <p className="mt-1 text-xs text-muted">
                      {p.burServicesCompleted ?? 0} usług
                      {p.burRatingX10 ? ` · ${(p.burRatingX10 / 10).toFixed(1)}` : ""}
                      {p.burReviewCount ? ` (${p.burReviewCount})` : ""}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3"><ProspectStatusSelect prospectId={p.id} current={p.status} /></td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${PROSPECT_PRIORITY_COLORS[p.priority]}`}>
                    {PROSPECT_PRIORITY_LABELS[p.priority]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDate(p.updatedAt)}</td>
              </tr>
            ))}
            {prospects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  {total === 0 ? (
                    <>Baza prospektów jest pusta. <Link href="/admin/crm-trenerki/nowy" className="font-semibold text-sand-700 hover:underline">Dodaj pierwszy podmiot</Link>.</>
                  ) : (
                    "Brak prospektów dla wybranych filtrów."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
