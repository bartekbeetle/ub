/**
 * Wiedza o dofinansowaniach z BUR — fosa recepcjonistki.
 *
 * Po co to istnieje: kursantka nie odpada na cenie kursu, tylko na formalnościach przed
 * kursem. Nikt na rynku nie mówi jej, KTÓRY operator obsługuje jej region i DO KIEDY trwa
 * nabór. To jest jedyna rzecz, którą recepcjonistka może dać w pierwszej minucie rozmowy,
 * zanim w ogóle mamy dla niej trenerkę.
 *
 * Dane: `content/bur/operatorzy.json` — wyciąg z oficjalnej listy operatorów PARP
 * (stan 23.03.2026, 268 rekordów). Rozbiór i tabela źródeł:
 * `firmy/uniwersytet-beauty/bur/baza-wiedzy-bur.md` w vaulcie Sejf.
 *
 * ⚠️ ZASADA NADRZĘDNA: ten moduł zwraca to, co jest w danych, i NIC PONADTO.
 * Recepcjonistka nie ma prawa wygenerować kwoty ani daty, której tu nie ma — dlatego
 * każda odpowiedź niesie `pewnosc` i `stanDanych`. Wprowadzenie kursantki w błąd co do
 * dofinansowania nie jest wpadką copywriterską.
 */

import operatorzyRaw from "../../content/bur/operatorzy.json";

/** Data, na którą sporządzona jest lista PARP. Recepcjonistka MA to mówić przy każdej liczbie. */
export const STAN_LISTY_PARP = "2026-03-23";

export type GrupaDocelowa = "osoby-fizyczne" | "firmy-i-pracownicy" | "mieszana" | "do-weryfikacji";

export type Operator = {
  operator: string;
  nip: string;
  start: string;
  koniec: string;
  instytucja: string;
  nrProjektu: string;
  tytul: string;
  wojewodztwo: string;
  program: string;
  grupaDocelowa: GrupaDocelowa;
  /** Dni do końca projektu. Ujemne = projekt już się zakończył. */
  dniDoKonca: number;
};

type Raw = {
  operator: string;
  nip: string;
  start: string;
  koniec: string;
  instytucja: string;
  nr_projektu: string;
  tytul: string;
  wojewodztwo: string;
  program: string;
  grupa_docelowa: string;
};

/** „dd.mm.rrrr" → Date. Zwraca null zamiast rzucać — jeden zepsuty wiersz nie może wywalić rozmowy. */
function parseDate(s: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s?.trim() ?? "");
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const DZIEN = 24 * 60 * 60 * 1000;

function toOperator(r: Raw, teraz: Date): Operator {
  const koniec = parseDate(r.koniec);
  return {
    operator: r.operator,
    nip: r.nip,
    start: r.start,
    koniec: r.koniec,
    instytucja: r.instytucja,
    nrProjektu: r.nr_projektu,
    tytul: r.tytul,
    wojewodztwo: r.wojewodztwo,
    program: r.program,
    grupaDocelowa: (r.grupa_docelowa as GrupaDocelowa) ?? "do-weryfikacji",
    dniDoKonca: koniec ? Math.floor((koniec.getTime() - teraz.getTime()) / DZIEN) : -1,
  };
}

/** Ścieżka finansowania — odpowiednik `projectTrackEnum` w schemacie bazy. */
export type Sciezka = "osoby_dorosle" | "przedsiebiorcy" | "nieznana";

function pasujeDoSciezki(g: GrupaDocelowa, s: Sciezka): boolean {
  if (s === "nieznana") return true;
  if (s === "osoby_dorosle") return g === "osoby-fizyczne" || g === "mieszana" || g === "do-weryfikacji";
  return g === "firmy-i-pracownicy" || g === "mieszana" || g === "do-weryfikacji";
}

function normWoj(w: string): string {
  return (w ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Operatorzy obsługujący dane województwo, posortowani od najbliżej kończącego się projektu.
 * Najbliższy termin idzie pierwszy, bo to jedyna presja, jakiej wolno nam używać — i jedyna,
 * którą kursantka może samodzielnie sprawdzić u operatora.
 */
export function operatorzyDla(
  wojewodztwo: string,
  sciezka: Sciezka = "nieznana",
  teraz: Date = new Date()
): Operator[] {
  const w = normWoj(wojewodztwo);
  return (operatorzyRaw as Raw[])
    .map((r) => toOperator(r, teraz))
    .filter((o) => normWoj(o.wojewodztwo) === w)
    .filter((o) => o.dniDoKonca >= 0)
    .filter((o) => pasujeDoSciezki(o.grupaDocelowa, sciezka))
    .sort((a, b) => a.dniDoKonca - b.dniDoKonca);
}

export type Pewnosc = "wysoka" | "wymaga_weryfikacji" | "brak_danych";

export type WynikDlaWojewodztwa = {
  wojewodztwo: string;
  sciezka: Sciezka;
  /** Ile aktywnych projektów w ogóle — miara „czy w tym regionie są pieniądze". */
  liczbaProjektow: number;
  /** Ile z nich ma POTWIERDZONĄ grupę docelową (nie „do-weryfikacji"). */
  liczbaPotwierdzonych: number;
  operatorzy: Operator[];
  najblizszyTermin: string | null;
  pewnosc: Pewnosc;
  stanDanych: string;
  /** Gotowe zastrzeżenie do wypowiedzenia. Recepcjonistka MA je podać razem z liczbami. */
  zastrzezenie: string;
};

/**
 * Pre-check przed rozmową: czy w jej województwie w ogóle są dla niej pieniądze.
 *
 * Po co osobno: lead z regionu, w którym nie ma naboru dla jego ścieżki, to koszt rozmowy
 * i koszt kliknięcia bez szans na zapis — a UB zarabia dopiero na ZAPISIE. Uczciwa
 * dyskwalifikacja w drugiej minucie jest tańsza niż sześć tygodni pielęgnacji.
 *
 * Przykład z danych: małopolskie ma 7 aktywnych projektów i ZERO nakierowanych na osoby
 * fizyczne — cały region jedzie bonami dla przedsiębiorców.
 */
export function dostepnoscDla(
  wojewodztwo: string,
  sciezka: Sciezka = "nieznana",
  teraz: Date = new Date()
): WynikDlaWojewodztwa {
  const ops = operatorzyDla(wojewodztwo, sciezka, teraz);
  const potwierdzone = ops.filter((o) => o.grupaDocelowa !== "do-weryfikacji").length;

  let pewnosc: Pewnosc = "brak_danych";
  if (ops.length > 0) pewnosc = potwierdzone > 0 ? "wysoka" : "wymaga_weryfikacji";

  return {
    wojewodztwo,
    sciezka,
    liczbaProjektow: ops.length,
    liczbaPotwierdzonych: potwierdzone,
    operatorzy: ops.slice(0, 5),
    najblizszyTermin: ops[0]?.koniec ?? null,
    pewnosc,
    stanDanych: STAN_LISTY_PARP,
    zastrzezenie:
      ops.length === 0
        ? "W naszych danych nie ma aktywnego projektu dla tej ścieżki w tym województwie. To nie znaczy, że go nie ma — lista PARP bywa niekompletna. Trzeba sprawdzić u operatora."
        : "Data zakończenia dotyczy PROJEKTU, nie naboru — nabór potrafi zamknąć się wcześniej po wyczerpaniu środków. Do potwierdzenia u operatora.",
  };
}

/**
 * Twarde parametry finansowania z realnego regulaminu naboru.
 *
 * ŹRÓDŁO: „Usługi rozwojowe w subregionie północnym woj. śląskiego", operator Związek Gmin
 * i Powiatów Subregionu Północnego Woj. Śląskiego, działanie FESL.06.06, regulamin
 * obowiązujący od 01.09.2025.
 *
 * ⚠️ To jest JEDEN subregion JEDNEGO województwa. Każdy operator ma własny regulamin
 * i własne progi. Te liczby wolno podawać wyłącznie jako PRZYKŁAD tego, jak to wygląda —
 * nigdy jako obietnicę dla konkretnej kursantki.
 */
export const PRZYKLADOWE_PARAMETRY = {
  zrodlo: "Regulamin naboru, subregion północny woj. śląskiego, obowiązuje od 01.09.2025",
  maksPoziomDofinansowaniaProc: 95,
  minWkladWlasnyProc: 5,
  /** Sufit dofinansowania na osobę — szkolenie/walidacja/certyfikacja. */
  capNaOsobePln: 5000,
  capStudiaPodyplomowePln: 10000,
  /** Maksymalny koszt 1 godziny usługi. */
  capZaGodzinePln: 492,
} as const;

/**
 * Ile realnie dopłaci kursantka przy danej cenie kursu brutto.
 *
 * To jest liczba, która sprzedaje — i jednocześnie ta, na której najłatwiej skłamać.
 * Cap 5 000 zł sprawia, że przy droższych kursach wkład własny przestaje być „kilkaset
 * złotych" i zaczyna szybko rosnąć. Powyżej ~5 263 zł brutto przekaz „dopłacasz kilkaset"
 * przestaje być prawdziwy.
 *
 * ⚠️ Liczy wg PRZYKŁADOWYCH parametrów (patrz wyżej). Wynik jest orientacyjny i MUSI być
 * podany z zastrzeżeniem, że progi ustala operator.
 */
export function szacunkowaDoplata(cenaBruttoPln: number): {
  cenaBruttoPln: number;
  dofinansowaniePln: number;
  doplataPln: number;
  ograniczoneCapem: boolean;
  zastrzezenie: string;
} {
  const { maksPoziomDofinansowaniaProc, capNaOsobePln } = PRZYKLADOWE_PARAMETRY;
  const zProcentu = Math.round((cenaBruttoPln * maksPoziomDofinansowaniaProc) / 100);
  const dofinansowanie = Math.min(zProcentu, capNaOsobePln);
  return {
    cenaBruttoPln,
    dofinansowaniePln: dofinansowanie,
    doplataPln: Math.max(0, cenaBruttoPln - dofinansowanie),
    ograniczoneCapem: zProcentu > capNaOsobePln,
    zastrzezenie:
      "Wyliczenie orientacyjne, na przykładowych progach jednego naboru. Poziom dofinansowania, limit na osobę i wkład własny ustala operator w regulaminie — kwotę potwierdzamy przed decyzją.",
  };
}

/** Statystyka zbiorcza — do panelu i do decyzji, gdzie pozyskiwać trenerki. */
export function podsumowanieKraju(teraz: Date = new Date()) {
  const wg = new Map<string, { aktywne: number; dlaOsob: number }>();
  for (const r of operatorzyRaw as Raw[]) {
    const o = toOperator(r, teraz);
    if (o.dniDoKonca < 0) continue;
    const k = o.wojewodztwo;
    const cur = wg.get(k) ?? { aktywne: 0, dlaOsob: 0 };
    cur.aktywne += 1;
    if (o.grupaDocelowa === "osoby-fizyczne" || o.grupaDocelowa === "mieszana") cur.dlaOsob += 1;
    wg.set(k, cur);
  }
  return [...wg.entries()]
    .map(([wojewodztwo, v]) => ({ wojewodztwo, ...v }))
    .sort((a, b) => b.aktywne - a.aktywne);
}
