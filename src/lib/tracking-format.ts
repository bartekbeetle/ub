/**
 * Normalizacja danych kontaktowych pod platformy reklamowe — CZYSTE funkcje string-in/string-out,
 * bez `node:crypto` i bez `"server-only"`. Dzięki temu ten plik wolno importować zarówno z API routes
 * (serwer), jak i z komponentów klienckich (Google Ads enhanced conversions każe wysyłać e-mail/telefon
 * w standardowym formacie i SAM je haszuje po stronie gtag — patrz `LeadConversion.tsx`).
 *
 * Meta i Google chcą różnych formatów telefonu:
 * - Meta CAPI: same cyfry z kierunkowym, BEZ plusa (np. `48512345678`) — potem hashowane (`meta-capi-core.ts`).
 * - Google Ads enhanced conversions: E.164, Z plusem (np. `+48512345678`), gtag hashuje sam.
 */

/** E-mail do dopasowania: przytnij białe znaki, małe litery. Ten sam wektor testowy co w dokumentacji
 * Mety (`" Test@Example.com "` → `test@example.com`) i Google (case + spacje). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Same cyfry, z kierunkowym `48`, bez plusa i bez wiodących zer.
 * Wejście z naszych formularzy to zawsze polski numer (walidacja `leadSchema`/`Quiz` dopuszcza
 * tylko cyfry, spacje, myślnik, +), więc reguła jest prosta:
 * - 9 cyfr → dopisz `48` z przodu,
 * - 11 cyfr zaczynających się od `48` → zostaw,
 * - `0048...` → zdejmij `00`,
 * - inne długości → zwróć same cyfry (best-effort; nie zgadujemy obcego kierunkowego).
 */
export function normalizePhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0048")) digits = digits.slice(2);
  if (digits.length === 9) return `48${digits}`;
  if (digits.length === 11 && digits.startsWith("48")) return digits;
  return digits;
}

/** E.164 dla Google Ads enhanced conversions: `+` + numer znormalizowany jak wyżej. */
export function toE164PL(phone: string): string {
  return `+${normalizePhoneDigits(phone)}`;
}
