/**
 * Etapy CRM ADMINA (`/admin/crm-kursantki`) — czysty moduł (bez bazy i `server-only`),
 * bo importują go komponenty klienckie i testy.
 *
 * Dwa Kanbany:
 *  1. LEJEK — kursantki bez przydziału: nowa → zakwalifikowana / odrzucona (pole `leads.qualification`).
 *  2. TABLICA trenerki × kategorii — cykl sprzedaży po przydziale (pole `lead_assignments.admin_stage`).
 *
 * 🔴 ROZLICZENIA: o naliczeniu decyduje WYŁĄCZNIE `lead_assignments.status`. Etap tablicy jest tylko
 * jego doprecyzowaniem; jedyne mapowanie to `PIPELINE_STAGE_TO_STATUS` niżej. Naliczenie 10% wpada
 * na etapie „Wpłaciła" (decyzja Bartka 08.10.2026), NIE na „Zapisała się" — dlatego etap przed
 * wpłatą ma klucz `zapis`, a nie `zapisana`: status `zapisana` w całej aplikacji znaczy „naliczone".
 */

export const FUNNEL_STAGES = ["nowa", "zakwalifikowana", "odrzucona"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  nowa: "Nowa ze strony",
  zakwalifikowana: "Zakwalifikowana",
  odrzucona: "Odrzucona",
};

export const FUNNEL_STAGE_COLORS: Record<FunnelStage, string> = {
  nowa: "bg-amber-100 text-amber-800",
  zakwalifikowana: "bg-emerald-100 text-emerald-800",
  odrzucona: "bg-red-100 text-red-700",
};

export function isFunnelStage(v: unknown): v is FunnelStage {
  return typeof v === "string" && (FUNNEL_STAGES as readonly string[]).includes(v);
}

export const PIPELINE_STAGES = [
  "przypisana",
  "nie_odbiera",
  "dzwonilem",
  "odpowiedziala",
  "rozmowa",
  "wniosek_w_trakcie",
  "wniosek_zlozony",
  "zapis",
  "wplacila",
  "dotarla",
  "rezygnacja",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  przypisana: "Przypisana",
  nie_odbiera: "Nie odbiera",
  dzwonilem: "Dzwoniłem",
  odpowiedziala: "Odpowiedziała",
  rozmowa: "Rozmowa",
  wniosek_w_trakcie: "Wniosek w trakcie",
  wniosek_zlozony: "Wniosek złożony",
  zapis: "Zapisała się",
  wplacila: "Wpłaciła (10%)",
  dotarla: "Dotarła na kurs",
  rezygnacja: "Rezygnacja",
};

export const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  przypisana: "bg-amber-100 text-amber-800",
  nie_odbiera: "bg-orange-100 text-orange-800",
  dzwonilem: "bg-purple-100 text-purple-800",
  odpowiedziala: "bg-violet-100 text-violet-800",
  rozmowa: "bg-sky-100 text-sky-800",
  wniosek_w_trakcie: "bg-indigo-100 text-indigo-800",
  wniosek_zlozony: "bg-blue-100 text-blue-800",
  zapis: "bg-teal-100 text-teal-800",
  wplacila: "bg-emerald-100 text-emerald-800",
  dotarla: "bg-green-200 text-green-900",
  rezygnacja: "bg-red-100 text-red-700",
};

export type AssignmentStatusValue = "przydzielony" | "skontaktowany" | "zapisana" | "odrzucony";

/** JEDYNE mapowanie etap tablicy → status przydziału (status decyduje o naliczeniu). */
export const PIPELINE_STAGE_TO_STATUS: Record<PipelineStage, AssignmentStatusValue> = {
  przypisana: "przydzielony",
  nie_odbiera: "skontaktowany",
  dzwonilem: "skontaktowany",
  odpowiedziala: "skontaktowany",
  rozmowa: "skontaktowany",
  wniosek_w_trakcie: "skontaktowany",
  wniosek_zlozony: "skontaktowany",
  zapis: "skontaktowany",
  wplacila: "zapisana",
  dotarla: "zapisana",
  rezygnacja: "odrzucony",
};

export function isPipelineStage(v: unknown): v is PipelineStage {
  return typeof v === "string" && (PIPELINE_STAGES as readonly string[]).includes(v);
}

/**
 * Etap widoczny na tablicy. Gdy `admin_stage` pasuje do statusu — bierzemy go; gdy nie
 * (status zmieniony gdzie indziej: stary widok leada, rozliczenia), wyprowadzamy etap ze statusu,
 * żeby karta nigdy nie stała w kolumnie sprzecznej z naliczeniem.
 */
export function pipelineStageOf(status: AssignmentStatusValue, adminStage: string | null | undefined): PipelineStage {
  if (isPipelineStage(adminStage) && PIPELINE_STAGE_TO_STATUS[adminStage] === status) return adminStage;
  switch (status) {
    case "przydzielony":
      return "przypisana";
    case "skontaktowany":
      return "dzwonilem";
    case "zapisana":
      return "wplacila";
    case "odrzucony":
      return "rezygnacja";
  }
}

/** Nazwa tablicy domyślnie: „Trenerka · Kategoria". */
export function defaultBoardName(trainerName: string, category: string): string {
  return `${trainerName} · ${category}`;
}
