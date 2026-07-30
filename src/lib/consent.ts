/**
 * Zgoda na cookies analityczne i marketingowe (GA4 + Meta Pixel).
 *
 * Zasada: skrypty śledzące NIE ładują się, dopóki użytkowniczka sama nie wyrazi zgody.
 * Brak decyzji = brak zgody (nie wolno domyślnie zakładać zgody — art. 173 Prawa komunikacji
 * elektronicznej, wyrok TSUE Planet49). Cookies niezbędne (sesja panelu) działają zawsze.
 *
 * Zgoda jest ROZDZIELONA na cele. Analityka i marketing to dwa różne cele przetwarzania
 * (statystyka ruchu vs profilowanie reklamowe po stronie Meta), więc muszą dać się przyjąć
 * osobno — spakowanie ich w jeden przycisk jest kwestionowane przez EDPB i UODO.
 * Kto chce jednym kliknięciem, nadal ma „Akceptuję wszystkie".
 */

export const CONSENT_KEY = "ub_consent_v2";
/** Klucz pierwszej wersji banera (jedna zgoda na wszystko) — migrujemy go, nie kasujemy decyzji. */
export const LEGACY_CONSENT_KEY = "ub_consent_v1";
export const CONSENT_EVENT = "ub-consent-change";

export type ConsentPrefs = {
  /** Google Analytics 4 — statystyka ruchu. */
  analytics: boolean;
  /** Meta Pixel — pomiar i optymalizacja reklam, profilowanie po stronie Meta. */
  marketing: boolean;
};

/** `null` = użytkowniczka jeszcze nie zdecydowała → nie wolno ładować niczego. */
export type ConsentState = ConsentPrefs | null;

export const CONSENT_ALL: ConsentPrefs = { analytics: true, marketing: true };
export const CONSENT_NONE: ConsentPrefs = { analytics: false, marketing: false };

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ConsentPrefs>;
      return { analytics: parsed.analytics === true, marketing: parsed.marketing === true };
    }
    // Migracja z v1: „granted" = zgoda na oba cele, „denied" = brak zgody na oba.
    const legacy = window.localStorage.getItem(LEGACY_CONSENT_KEY);
    if (legacy === "granted") return CONSENT_ALL;
    if (legacy === "denied") return CONSENT_NONE;
    return null;
  } catch {
    // Prywatne okno / zablokowany storage — traktujemy jak brak zgody.
    return null;
  }
}

export function writeConsent(prefs: ConsentPrefs) {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
    window.localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* brak storage — zgoda obowiązuje tylko na tę sesję */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: prefs }));
}

/** Wycofanie zgody musi być tak samo łatwe jak jej udzielenie (art. 7 ust. 3 RODO). */
export function clearConsent() {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
    window.localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
}
