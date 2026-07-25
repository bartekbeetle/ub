export const SITE_NAME = "Uniwersytet Beauty";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const CONTACT_EMAIL = "biuro@uniwersytetbeauty.pl";

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

/** Jednozdaniowa definicja encji — używana w schema.org, llms.txt i OG. Trzymamy JEDNĄ wersję. */
export const ORG_DESCRIPTION =
  "Uniwersytet Beauty to polska platforma, która łączy kobiety chcące zdobyć zawód w branży beauty z certyfikowanymi trenerkami i prowadzi je przez proces dofinansowania szkolenia z Bazy Usług Rozwojowych (BUR) — do 90% ceny kursu.";

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

export const SOURCE_LABELS: Record<string, string> = {
  kurs: "Karta kursu",
  landing: "Landing",
  konsultacja: "Konsultacja",
};
