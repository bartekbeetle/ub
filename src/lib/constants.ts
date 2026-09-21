export const SITE_NAME = "Uniwersytet Beauty";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const CONTACT_EMAIL = "biuro@uniwersytetbeauty.pl";

/**
 * Podmiot prowadzący serwis = administrator danych osobowych.
 * Uniwersytet Beauty działa jako marka w ramach JDG Bartosza Chrząszcza (decyzja 2026-07-25,
 * tymczasowa — rewizja przed startem FB Ads, patrz docs/podatki/rejestr.md w vaulcie).
 *
 * Te dane MUSZĄ być publicznie dostępne w serwisie: art. 13 RODO (tożsamość administratora)
 * + art. 5 ustawy o świadczeniu usług drogą elektroniczną (identyfikacja usługodawcy).
 *
 * TODO(Bartek) przed deployem na domenę: potwierdź (1) pełną nazwę firmy z CEIDG —
 * wykaz VAT zwraca samo imię i nazwisko, a w CEIDG jest zwykle „Bartosz Chrząszcz <nazwa>";
 * (2) adres do publikacji — poniższy pochodzi z rejestru i BĘDZIE WIDOCZNY PUBLICZNIE.
 */
export const OPERATOR = {
  legalName: "Bartosz Chrząszcz",
  tradeName: "Niezależny Przedsiębiorca",
  nip: "8883009310",
  regon: "222042995",
  street: "ul. Józefa Czyżewskiego 25/70",
  postalCode: "80-336",
  city: "Gdańsk",
  country: "PL",
} as const;

/** Jednolinijkowa identyfikacja do stopki i dokumentów. */
export const OPERATOR_LINE = `${OPERATOR.legalName} — ${OPERATOR.tradeName}, ${OPERATOR.street}, ${OPERATOR.postalCode} ${OPERATOR.city}, NIP ${OPERATOR.nip}, REGON ${OPERATOR.regon}`;

/**
 * Wersja klauzul zgód w formularzu zgłoszeniowym. Zapisywana przy każdym leadzie.
 * Podbij datę ZAWSZE, gdy zmienia się treść którejkolwiek zgody — inaczej nie da się odtworzyć,
 * na co konkretnie zgodziła się osoba, która zgłosiła się w przeszłości (rozliczalność, art. 5 ust. 2 RODO).
 */
export const CONSENT_VERSION = "2026-07-30";

/** Docelowa domena produkcyjna. Wszystko poza nią (sslip.io, localhost, preview) NIE MOŻE trafić do indeksu. */
export const CANONICAL_DOMAIN = "uniwersytetbeauty.pl";

/**
 * Czy ta instancja jest publiczną, indeksowalną produkcją.
 * Adresy tymczasowe (Coolify sslip.io, localhost) zwracają false → robots.txt blokuje wszystko
 * + każda strona dostaje `noindex`. Chroni przed zaindeksowaniem tymczasowego hosta
 * i duplikatem treści po przepięciu domeny.
 */
export const IS_PRODUCTION_HOST = (() => {
  try {
    const h = new URL(SITE_URL).hostname;
    return h === CANONICAL_DOMAIN || h.endsWith(`.${CANONICAL_DOMAIN}`);
  } catch {
    return false;
  }
})();

/** Profile społecznościowe do `sameAs` w schema.org — konsolidują encję dla Google i modeli AI. */
export const SOCIAL_URLS = (process.env.NEXT_PUBLIC_SOCIAL_URLS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Poziom dofinansowania z BUR — JEDNO źródło prawdy dla całego serwisu, reklam i llms.txt.
 *
 * 🔴 NIE wpisuj procentów na sztywno w komponentach i treściach. To jest liczba, którą
 * możemy musieć skorygować po weryfikacji u PARP albo po uwadze prawnika — a wtedy zmiana
 * ma być JEDNĄ linią tutaj, nie przeczesywaniem dwudziestu plików (stan przed 13.09.2026:
 * „do 90%" występowało w 21 miejscach w kodzie i treściach).
 *
 * Zakres ustawiony 13.09.2026 pod start kampanii i ZWERYFIKOWANY u źródła (PARP):
 *  - górna granica: mazowiecki Projekt 3 daje „od 92,2% do 96,2%", łódzkie „do 93%"
 *    → komunikujemy 95%, czyli MNIEJ niż udokumentowane maksimum. Bezpieczna strona.
 *  - dolna granica: łódzkie 50% dla dużych przedsiębiorstw i pracodawców spoza biznesu.
 * Pełny rozbiór z tabelą źródeł:
 * `Zasoby/research/2026-09-13-poziomy-dofinansowania-bur-weryfikacja.md`
 *
 * 🔴 SUFFIX `SUBSIDY_CONDITION` JEST OBOWIĄZKOWY przy każdej liczbie. Powód nie jest
 * kosmetyczny: duża część operatorów ogranicza wsparcie NIE procentem, lecz KWOTĄ
 * (wielkopolskie: 5 000 zł na uczestnika). Przy kursie za 8 000 zł realne dofinansowanie
 * wyniesie tam 62%, nie 95% — i bez warunku byłby to zarzut wprowadzenia w błąd.
 */
export const SUBSIDY_MIN_PERCENT = 50;
export const SUBSIDY_MAX_PERCENT = 95;
/** „od 50% do nawet 95%" — gotowa fraza do treści. */
export const SUBSIDY_RANGE = `od ${SUBSIDY_MIN_PERCENT}% do nawet ${SUBSIDY_MAX_PERCENT}%`;
/** Warunek, który MUSI towarzyszyć każdej liczbie — guardrail przeciw „0 zł" i obietnicy bez pokrycia. */
export const SUBSIDY_CONDITION = "zależnie od województwa, naboru i Twojego statusu zawodowego";

/**
 * Jednozdaniowa definicja encji — używana w schema.org, llms.txt i OG. Trzymamy JEDNĄ wersję.
 * Musi siedzieć PO `SUBSIDY_RANGE` (zależność) — dlatego nie jest zdefiniowana na górze pliku,
 * gdzie była do 13.09.2026, kiedy jeszcze cytowała „do 90%" na sztywno.
 */
export const ORG_DESCRIPTION = `Uniwersytet Beauty to polska platforma, która łączy kobiety chcące zdobyć zawód w branży beauty z certyfikowanymi trenerkami i prowadzi je przez proces dofinansowania szkolenia z Bazy Usług Rozwojowych (BUR) — ${SUBSIDY_RANGE} ceny kursu.`;

export const CATEGORIES = [
  "PMU / Makijaż permanentny",
  "Stylizacja rzęs",
  "Stylizacja brwi",
  "Stylizacja paznokci",
  "Medycyna estetyczna",
  "Kosmetologia",
  "Manicure & Pedicure",
  "Fryzjerstwo",
  "Masaż",
  "Depilacja",
  "Inne",
] as const;

export const LEVELS = ["Podstawowy", "Średniozaawansowany", "Zaawansowany"] as const;

export const MODES = ["Stacjonarny", "Online", "Hybrydowy"] as const;

export const BLOG_CATEGORIES = ["Poradniki", "Dofinansowania", "Kariera w Beauty", "Trendy"] as const;

export const EMPLOYMENT_STATUSES = [
  "pracująca",
  "studentka",
  "przedsiębiorczyni",
  "mama na macierzyńskim",
  "bezrobotna",
  "inna",
] as const;

export const VOIVODESHIPS = [
  { slug: "dolnoslaskie", name: "Dolnośląskie" },
  { slug: "kujawsko-pomorskie", name: "Kujawsko-Pomorskie" },
  { slug: "lubelskie", name: "Lubelskie" },
  { slug: "lubuskie", name: "Lubuskie" },
  { slug: "lodzkie", name: "Łódzkie" },
  { slug: "malopolskie", name: "Małopolskie" },
  { slug: "mazowieckie", name: "Mazowieckie" },
  { slug: "opolskie", name: "Opolskie" },
  { slug: "podkarpackie", name: "Podkarpackie" },
  { slug: "podlaskie", name: "Podlaskie" },
  { slug: "pomorskie", name: "Pomorskie" },
  { slug: "slaskie", name: "Śląskie" },
  { slug: "swietokrzyskie", name: "Świętokrzyskie" },
  { slug: "warminsko-mazurskie", name: "Warmińsko-Mazurskie" },
  { slug: "wielkopolskie", name: "Wielkopolskie" },
  { slug: "zachodniopomorskie", name: "Zachodniopomorskie" },
] as const;

export function voivodeshipName(slug: string | null | undefined): string {
  if (!slug) return "";
  return VOIVODESHIPS.find((v) => v.slug === slug)?.name ?? slug;
}

export const LEAD_STATUSES = [
  "nowy",
  "przydzielony",
  "skontaktowany",
  "zapisana",
  "rozliczony",
  "odrzucony",
] as const;

export const LEAD_STATUS_LABELS: Record<string, string> = {
  nowy: "Nowy",
  przydzielony: "Przydzielony",
  skontaktowany: "Skontaktowany",
  zapisana: "Zapisana",
  rozliczony: "Rozliczony",
  odrzucony: "Odrzucony",
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
  nowy: "bg-blue-100 text-blue-800",
  przydzielony: "bg-amber-100 text-amber-800",
  skontaktowany: "bg-purple-100 text-purple-800",
  zapisana: "bg-emerald-100 text-emerald-800",
  rozliczony: "bg-gray-200 text-gray-700",
  odrzucony: "bg-red-100 text-red-700",
};

export const BILLING_STATUS_LABELS: Record<string, string> = {
  do_zafakturowania: "Do zafakturowania",
  zafakturowane: "Zafakturowane",
  oplacone: "Opłacone",
};

export const LEAD_SOURCES = ["kurs", "landing", "konsultacja", "quiz", "recepcjonistka"] as const;

export const SOURCE_LABELS: Record<string, string> = {
  kurs: "Karta kursu",
  landing: "Landing",
  konsultacja: "Konsultacja",
  quiz: "Quiz",
  recepcjonistka: "Recepcjonistka",
};

/**
 * Statusy, w których lead jest ZAMKNIĘTY — nic już z nim nie robimy.
 * Reszta („nowy", „przydzielony", „skontaktowany") leci do kubełka „do zrobienia"
 * w jednym oknie Kursantek, razem z nieobsłużonymi zgłoszeniami.
 */
export const LEAD_STATUSES_CLOSED = ["zapisana", "rozliczony", "odrzucony"] as const;

export const LEAD_STATUSES_OPEN = ["nowy", "przydzielony", "skontaktowany"] as const;

// ===== ZGŁOSZENIA (formularz kontaktowy) =====

export const SUBMISSION_TYPES = ["kontakt", "konsultacja"] as const;

export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  kontakt: "Kontakt",
  konsultacja: "Konsultacja",
};

/**
 * Mapowanie typu zgłoszenia na źródło leada przy konwersji.
 * „kontakt" nie ma swojego odpowiednika w `lead_source` — wpada w „landing",
 * bo formularz kontaktowy stoi na stronie. Pełny ślad pochodzenia i tak zostaje
 * w `submissions.converted_to_lead_id` oraz w audit logu.
 */
export const SUBMISSION_TYPE_TO_LEAD_SOURCE: Record<string, (typeof LEAD_SOURCES)[number]> = {
  kontakt: "landing",
  konsultacja: "konsultacja",
};

// ===== CRM TRENEREK (pipeline B2B) =====

export const PROSPECT_STATUSES = [
  "potencjalny",
  "research",
  "do_kontaktu",
  "kontakt",
  "rozmowa",
  "umowa",
  "aktywna",
  "odrzucony",
  "parking",
] as const;

export const PROSPECT_STATUS_LABELS: Record<string, string> = {
  potencjalny: "Potencjalny",
  research: "Research w toku",
  do_kontaktu: "Do kontaktu",
  kontakt: "Kontakt nawiązany",
  rozmowa: "Rozmowa",
  umowa: "Umowa",
  aktywna: "Aktywna",
  odrzucony: "Odrzucony",
  parking: "Parking",
};

export const PROSPECT_STATUS_COLORS: Record<string, string> = {
  potencjalny: "bg-gray-200 text-gray-700",
  research: "bg-blue-100 text-blue-800",
  do_kontaktu: "bg-amber-100 text-amber-800",
  kontakt: "bg-purple-100 text-purple-800",
  rozmowa: "bg-sand-100 text-sand-700",
  umowa: "bg-emerald-100 text-emerald-800",
  aktywna: "bg-money-bg text-money-dark",
  odrzucony: "bg-red-100 text-red-700",
  parking: "bg-gray-100 text-gray-600",
};

/** Kolejność lejka do liczników — statusy „martwe" (odrzucony/parking) pokazujemy osobno. */
export const PROSPECT_PIPELINE_ORDER = [
  "potencjalny",
  "research",
  "do_kontaktu",
  "kontakt",
  "rozmowa",
  "umowa",
  "aktywna",
] as const;

export const PROSPECT_PRIORITIES = ["wysoki", "sredni", "niski"] as const;

export const PROSPECT_PRIORITY_LABELS: Record<string, string> = {
  wysoki: "Wysoki",
  sredni: "Średni",
  niski: "Niski",
};

export const PROSPECT_PRIORITY_COLORS: Record<string, string> = {
  wysoki: "bg-red-100 text-red-700",
  sredni: "bg-amber-100 text-amber-800",
  niski: "bg-gray-200 text-gray-600",
};

export const BUR_SEGMENTS = ["A", "B", "nieznany"] as const;

export const BUR_SEGMENT_LABELS: Record<string, string> = {
  A: "A — ma wpis do BUR",
  B: "B — brak wpisu do BUR",
  nieznany: "Nieznany",
};

export const BUR_SEGMENT_SHORT: Record<string, string> = {
  A: "BUR A",
  B: "BUR B",
  nieznany: "BUR ?",
};

export const BUR_SEGMENT_COLORS: Record<string, string> = {
  // Segment A = jedyni, którzy mogą dziś przyjąć leada z dofinansowaniem. Wyróżniony celowo.
  A: "bg-money-bg text-money-dark ring-1 ring-money",
  B: "bg-amber-100 text-amber-800",
  nieznany: "bg-gray-200 text-gray-600",
};

export const PROSPECT_SOURCES = ["research-lead", "reczny", "polecenie", "rejestracja"] as const;

export const PROSPECT_SOURCE_LABELS: Record<string, string> = {
  "research-lead": "Research po leadzie",
  reczny: "Dodany ręcznie",
  polecenie: "Polecenie",
  // Akademia sama założyła konto na `/dla-akademii/rejestracja`. Wyróżniamy to w CRM,
  // bo taka rozmowa zaczyna się z zupełnie innego miejsca niż zimny telefon z researchu:
  // ona już zna ofertę, zostawiła dane dobrowolnie i CZEKA na kontakt.
  rejestracja: "Zgłosiła się sama",
};

export const PROSPECT_ACTIVITY_TYPES = ["notatka", "telefon", "email", "spotkanie", "zmiana_statusu"] as const;

export const PROSPECT_ACTIVITY_LABELS: Record<string, string> = {
  notatka: "Notatka",
  telefon: "Telefon",
  email: "E-mail",
  spotkanie: "Spotkanie",
  zmiana_statusu: "Zmiana statusu",
};

export const RESEARCH_JOB_STATUSES = ["pending", "w_toku", "gotowe", "pominiete"] as const;

export const RESEARCH_JOB_STATUS_LABELS: Record<string, string> = {
  pending: "Czeka",
  w_toku: "W toku",
  gotowe: "Gotowe",
  pominiete: "Pominięte",
};

export const RESEARCH_JOB_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  w_toku: "bg-blue-100 text-blue-800",
  gotowe: "bg-emerald-100 text-emerald-800",
  pominiete: "bg-gray-200 text-gray-600",
};

/** Link do karty dostawcy w Bazie Usług Rozwojowych (PARP). */
export function burProviderUrl(providerId: string | null | undefined): string | null {
  if (!providerId) return null;
  return `https://uslugirozwojowe.parp.gov.pl/wyszukiwarka/dostawca-uslug/podglad?id=${providerId}`;
}
