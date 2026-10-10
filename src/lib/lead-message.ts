import { CATEGORIES } from "./constants";

/**
 * Odczyt pól miękkich z `leads.message` (składanego w `buildLeadPayload`, src/lib/quiz-form.ts).
 * Wiek, „skąd wie o nas”, „pracuje w beauty” i „interesuje ją też” nie mają własnych kolumn —
 * siedzą w wiadomości jako linie „Etykieta: wartość”. Etykiety muszą zgadzać się z quiz-form.ts.
 */
function line(message: string | null | undefined, label: string): string | null {
  if (!message) return null;
  for (const raw of message.split("\n")) {
    if (raw.startsWith(label)) {
      const v = raw.slice(label.length).trim();
      return v || null;
    }
  }
  return null;
}

export const messageAge = (m: string | null | undefined) => line(m, "Wiek:");
export const messageHeardFrom = (m: string | null | undefined) => line(m, "Skąd wie o nas:");
export const messageWorksInBeauty = (m: string | null | undefined) => line(m, "Pracuje już w beauty:");

/** „Interesuje ją też (multi-sell): A, B” → tylko znane kategorie, bez kategorii głównej. */
export function messageAlsoInterested(m: string | null | undefined, mainCategory?: string): string[] {
  const v = line(m, "Interesuje ją też (multi-sell):");
  if (!v) return [];
  const known = new Set<string>(CATEGORIES);
  return [...new Set(v.split(",").map((s) => s.trim()))].filter((c) => known.has(c) && c !== mainCategory);
}
