/**
 * Etapy CRM trenerki i znaczniki szablonów — czysty moduł (bez bazy i `server-only`),
 * bo importują go komponenty klienckie (lista, formularze) i testy.
 */

export const CRM_STAGES = [
  "nowa",
  "kontakt_podjety",
  "rozmowa_umowiona",
  "wniosek_bur",
  "zapisana",
  "rezygnacja",
] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  nowa: "Nowa",
  kontakt_podjety: "Kontakt podjęty",
  rozmowa_umowiona: "Rozmowa umówiona",
  wniosek_bur: "Wniosek BUR w toku",
  zapisana: "Zapisana",
  rezygnacja: "Rezygnacja",
};

export const CRM_STAGE_COLORS: Record<CrmStage, string> = {
  nowa: "bg-amber-100 text-amber-800",
  kontakt_podjety: "bg-purple-100 text-purple-800",
  rozmowa_umowiona: "bg-sky-100 text-sky-800",
  wniosek_bur: "bg-indigo-100 text-indigo-800",
  zapisana: "bg-emerald-100 text-emerald-800",
  rezygnacja: "bg-red-100 text-red-700",
};

export type AssignmentStatus = "przydzielony" | "skontaktowany" | "zapisana" | "odrzucony";

/** Mapowanie etap CRM → status przydziału (to on decyduje o naliczeniu). */
export const CRM_STAGE_TO_STATUS: Record<CrmStage, AssignmentStatus> = {
  nowa: "przydzielony",
  kontakt_podjety: "skontaktowany",
  rozmowa_umowiona: "skontaktowany",
  wniosek_bur: "skontaktowany",
  zapisana: "zapisana",
  rezygnacja: "odrzucony",
};

const SUBSTAGES = ["kontakt_podjety", "rozmowa_umowiona", "wniosek_bur"] as const;

/** Etap widoczny w CRM — wyliczany ze statusu (źródło prawdy) i podetapu. */
export function crmStageOf(status: AssignmentStatus, substage: string | null | undefined): CrmStage {
  switch (status) {
    case "przydzielony":
      return "nowa";
    case "zapisana":
      return "zapisana";
    case "odrzucony":
      return "rezygnacja";
    case "skontaktowany":
      return (SUBSTAGES as readonly string[]).includes(substage ?? "")
        ? (substage as CrmStage)
        : "kontakt_podjety";
  }
}

export function isCrmStage(v: unknown): v is CrmStage {
  return typeof v === "string" && (CRM_STAGES as readonly string[]).includes(v);
}


/**
 * Znaczniki w szablonach trenerki: `{imie}` i `{kurs}` (pojedyncze nawiasy — to nie jest
 * `renderTemplate` z `{{}}` używany w szablonach UB). `{imie}` to pierwszy człon imienia
 * w wołaczu („Anno"), bo służy do powitania. `{kurs}` to tytuł szkolenia, z którego przyszło
 * zgłoszenie, a gdy go brak — kategoria.
 */
export function renderCrmTemplate(text: string, vars: { imie: string; kurs: string }): string {
  return text.replace(/\{(imie|kurs)\}/g, (_, k: "imie" | "kurs") => vars[k]);
}

