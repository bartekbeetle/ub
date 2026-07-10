export const SITE_NAME = "Uniwersytet Beauty";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const CONTACT_EMAIL = "biuro@uniwersytetbeauty.pl";

export const CATEGORIES = [
  "Medycyna estetyczna",
  "PMU / Makijaż permanentny",
  "Fryzjerstwo",
  "Stylizacja paznokci",
  "Kosmetologia",
  "Manicure & Pedicure",
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
