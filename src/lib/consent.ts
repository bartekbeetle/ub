/**
 * Zgoda na cookies analityczne i marketingowe (GA4 + Meta Pixel).
 *
 * Zasada: skrypty śledzące NIE ładują się, dopóki użytkowniczka nie kliknie „Akceptuję".
 * Brak decyzji = brak zgody (nie wolno domyślnie zakładać zgody — art. 173 Prawa komunikacji
 * elektronicznej, wyrok TSUE Planet49). Cookies niezbędne (sesja panelu) działają zawsze.
 */

export const CONSENT_KEY = "ub_consent_v1";
export const CONSENT_EVENT = "ub-consent-change";

export type ConsentState = "granted" | "denied" | null;

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    // Prywatne okno / zablokowany storage — traktujemy jak brak zgody.
    return null;
  }
}

export function writeConsent(state: Exclude<ConsentState, null>) {
  try {
    window.localStorage.setItem(CONSENT_KEY, state);
  } catch {
    /* brak storage — zgoda obowiązuje tylko na tę sesję */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}
