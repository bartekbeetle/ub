/**
 * JEDNO ŹRÓDŁO LICZB O LEADACH (09.10.2026). Przed tym plikiem każdy ekran liczył po swojemu:
 * dashboard „w tym miesiącu" 10, lejek 29, „bez adresata" 28 (= 14 000 zł, z odrzuconymi
 * i zanonimizowanymi), „do obsłużenia" 31 (leady + zgłoszenia), a konwersja na dashboardzie
 * gubiła rozliczone. Każda liczba o leadach w panelu ma przyjść STĄD.
 *
 * Słownik — trzy rodzaje liczb, które NIE MAJĄ prawa być sobie równe:
 *  - WPŁYNĘŁO (`rekordy`, `dzis`, `miesiac`, wykres): każdy rekord w `leads`, łącznie
 *    z odrzuconymi i zanonimizowanymi — to historia napływu, nie stan roboczy.
 *  - OSOBY: rekordy po zdjęciu duplikatów po e-mailu. Ta sama kobieta wysyła aplikację
 *    dwa razy, a 500 zł dostajemy raz.
 *  - BEZ ADRESATA (stan roboczy): niezanonimizowana, nieodrzucona (ani `status`, ani
 *    `qualification`), bez żadnego przydziału. Ten sam warunek co lejek w CRM kursantek
 *    (`listFunnel` bez kolumny „Odrzucona") — kwota „na stole" liczona od OSÓB.
 *  - ZAPISANE: zawsze `zapisana` + `rozliczony` (rozliczona była najpierw zapisana).
 *
 * Granice dnia i miesiąca liczone w Europe/Warsaw po stronie bazy — kontener chodzi w UTC,
 * więc `setHours(0)` w Node przesuwał „dziś" o 1–2 h.
 */
import { and, isNull, ne, notExists, sql, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/admin-audit-core";

export const STAWKA_ZA_ZAPIS = 500;
export const STREFA = "Europe/Warsaw";

const L = schema.leads;

/** Klucz osoby: e-mail bez wielkości liter i spacji (telefony bywają z +48 i bez). */
const kluczOsoby = sql`lower(trim(${L.email}))`;

/**
 * Strefa jako literał, nie parametr: z parametrem `to_char(... at time zone $1)` w SELECT
 * i `$6` w GROUP BY to dla Postgresa dwa różne wyrażenia (błąd agregacji). Stała, nie dane od użytkownika.
 */
const STREFA_SQL = sql.raw(`'${STREFA}'`);

/** Początek dzisiejszego dnia / miesiąca w czasie polskim, jako timestamptz. */
const poczatek = (jednostka: "day" | "month") =>
  sql`(date_trunc(${sql.raw(`'${jednostka}'`)}, now() at time zone ${STREFA_SQL}) at time zone ${STREFA_SQL})`;

/** Warunek „lead czeka bez adresata" — wspólny dla lejka /kursantki i CRM kursantek. */
export function warunekBezAdresata(db: AnyDb): SQL {
  return and(
    isNull(L.anonymizedAt),
    ne(L.status, "odrzucony"),
    ne(L.qualification, "odrzucona"),
    notExists(
      db
        .select({ one: sql`1` })
        .from(schema.leadAssignments)
        .where(sql`${schema.leadAssignments.leadId} = ${L.id}`)
    )
  )!;
}

export type LeadMetrics = {
  /** Wszystkie rekordy, jakie kiedykolwiek wpłynęły. */
  rekordy: number;
  /** Unikalne osoby (po e-mailu) we wszystkich rekordach. */
  osoby: number;
  dzis: number;
  miesiac: number;
  /** Rekordy z co najmniej jednym przydziałem trenerce. */
  zPrzydzialem: number;
  bezAdresata: { rekordy: number; osoby: number; kwota: number };
  odrzucone: number;
  zanonimizowane: number;
  /** Skontaktowane i dalej: skontaktowany + zapisana + rozliczony. */
  skontaktowane: number;
  zapisane: number;
  rozliczone: number;
  /** zapisane / osoby, w procentach. */
  konwersja: number;
};

export async function liczLeady(db: AnyDb): Promise<LeadMetrics> {
  const [[r], [b]] = await Promise.all([
    db
      .select({
        rekordy: sql<number>`count(*)::int`,
        osoby: sql<number>`count(distinct ${kluczOsoby})::int`,
        dzis: sql<number>`count(*) filter (where ${L.createdAt} >= ${poczatek("day")})::int`,
        miesiac: sql<number>`count(*) filter (where ${L.createdAt} >= ${poczatek("month")})::int`,
        // Nazwy kolumn jawnie: w polach SELECT drizzle nie kwalifikuje kolumn tabelą,
        // więc `lead_id = id` porównałby lead_assignments.id zamiast leads.id.
        zPrzydzialem: sql<number>`count(*) filter (where exists (select 1 from lead_assignments la where la.lead_id = leads.id))::int`,
        odrzucone: sql<number>`count(*) filter (where ${L.status} = 'odrzucony' or ${L.qualification} = 'odrzucona')::int`,
        zanonimizowane: sql<number>`count(*) filter (where ${L.anonymizedAt} is not null)::int`,
        skontaktowane: sql<number>`count(*) filter (where ${L.status} in ('skontaktowany', 'zapisana', 'rozliczony'))::int`,
        zapisane: sql<number>`count(*) filter (where ${L.status} in ('zapisana', 'rozliczony'))::int`,
        rozliczone: sql<number>`count(*) filter (where ${L.status} = 'rozliczony')::int`,
      })
      .from(L),
    db
      .select({
        rekordy: sql<number>`count(*)::int`,
        osoby: sql<number>`count(distinct ${kluczOsoby})::int`,
      })
      .from(L)
      .where(warunekBezAdresata(db)),
  ]);

  return {
    rekordy: r.rekordy,
    osoby: r.osoby,
    dzis: r.dzis,
    miesiac: r.miesiac,
    zPrzydzialem: r.zPrzydzialem,
    bezAdresata: { rekordy: b.rekordy, osoby: b.osoby, kwota: b.osoby * STAWKA_ZA_ZAPIS },
    odrzucone: r.odrzucone,
    zanonimizowane: r.zanonimizowane,
    skontaktowane: r.skontaktowane,
    zapisane: r.zapisane,
    rozliczone: r.rozliczone,
    konwersja: r.osoby ? Math.round((r.zapisane / r.osoby) * 100) : 0,
  };
}

/** Napływ dzienny z ostatnich `dni` dni, klucz `RRRR-MM-DD` w czasie polskim, dni bez leadów = 0. */
export async function naplywDzienny(db: AnyDb, dni = 30): Promise<{ day: string; count: number }[]> {
  const dzien = sql<string>`to_char(${L.createdAt} at time zone ${STREFA_SQL}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day: dzien, c: sql<number>`count(*)::int` })
    .from(L)
    .where(sql`${L.createdAt} >= ${poczatek("day")} - make_interval(days => ${dni - 1})`)
    .groupBy(dzien);
  const byDay = new Map(rows.map((d) => [d.day, d.c]));
  // „sv-SE" formatuje datę jako RRRR-MM-DD — ten sam klucz co to_char wyżej.
  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: STREFA });
  const out: { day: string; count: number }[] = [];
  for (let i = dni - 1; i >= 0; i--) {
    const d = fmt.format(new Date(Date.now() - i * 86400000));
    out.push({ day: d, count: byDay.get(d) ?? 0 });
  }
  return out;
}
