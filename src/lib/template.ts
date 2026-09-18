/**
 * Podstawianie zmiennych w szablonach maili: {{imie}} → "Gabriela".
 *
 * Świadomie BEZ `server-only` i bez importu bazy — dzięki temu ta funkcja jest testowalna
 * ze skryptów (`npm run email:preview`) i z testów, a nie tylko w runtime Next.js.
 * `@/lib/email` re-eksportuje ją, żeby istniejące importy działały bez zmian.
 *
 * Brakująca zmienna daje pusty ciąg, NIE błąd — inaczej literówka w szablonie edytowanym
 * w panelu wywalałaby wysyłkę maila. Cenę tej decyzji (ciche „Dzień dobry ,") płaci
 * `email-preview`, który ostrzega o niepodstawionych zmiennych.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Forma grzecznościowa imienia do powitania w mailu.
 *
 * Dwa problemy, które to rozwiązuje:
 *  1. `leads.name` to „imię i nazwisko" (tak brzmi etykieta formularza), więc wstawione
 *     wprost daje „Dzień dobry Gabriela Nowak," — bierzemy sam pierwszy człon.
 *  2. Polski wołacz: „Dzień dobry Gabriela" brzmi jak automat. Imiona żeńskie zakończone
 *     na -a mają wołacz na -o (Gabriela → Gabrielo, Anna → Anno, Kasia → Kasiu... i tu
 *     kończy się prosta reguła).
 *
 * Świadome ograniczenie: odmieniamy TYLKO -a → -o, bo to pokrywa zdecydowaną większość
 * imion żeńskich, a nasza grupa docelowa to kobiety. Imiona zakończone inaczej zostawiamy
 * w mianowniku — lepiej „Dzień dobry Karmen" niż wymyślona forma. Zdrobnienia na -ia
 * (Kasia, Basia) dostają poprawne -iu.
 */
export function greetingName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  if (first.length < 3) return first;

  const lower = first.toLocaleLowerCase("pl");
  // Kasia → Kasiu, Basia → Basiu, Zosia → Zosiu
  if (lower.endsWith("ia")) return first.slice(0, -1) + "u";
  // Gabriela → Gabrielo, Anna → Anno, Marta → Marto
  if (lower.endsWith("a")) return first.slice(0, -1) + "o";
  return first;
}
