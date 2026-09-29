/**
 * JEDNA MAPA ZDARZEŃ — źródło prawdy dla Meta Pixel + GA4 + Google Ads, używana przez
 * `TrackEvent` (komponent) i wywoływana wprost z formularzy (`Quiz.tsx`, `AcademyRegistrationForm.tsx`)
 * tam, gdzie React-owy `<TrackEvent>` wymagałby zmiany JSX-a.
 *
 * 🔴 POPRAWKA BŁĘDU Z 22.09.2026 (audyt paneli 29.09): od uruchomienia nowego pikselu
 * (2307645766669921) w Meta Menedżerze zdarzeń widać PageView i pojedyncze Contact, ale
 * ZERO zdarzeń `Lead` — a GA4 `generate_lead` i tak dochodzi. Przyczyna leżała w starym
 * `TrackEvent.tsx`: jedna wspólna flaga `done` była ustawiana na `true`, gdy TYLKO JEDEN
 * z dwóch silników (fbq LUB gtag) był gotowy — który wygrał wyścig ładowania skryptów,
 * ten strzelał, drugi (zwykle wolniejszy `fbevents.js`) już nigdy nie dostawał szansy,
 * bo pętla `setInterval` kończyła się po pierwszym sukcesie. Efekt: gdy gtag ładował się
 * szybciej niż fbq (jak w naszej kolejności skryptów w `Analytics.tsx` — Pixel PRZED gtag,
 * ale to i tak wyścig sieciowy, nie kolejność w DOM), zdarzenie Lead wychodziło do GA4,
 * a Meta nie dostawało NIC — dokładnie taki obraz jak w panelach.
 *
 * Tu każdy kanał (Meta / GA4 / Google Ads) ma WŁASNY warunek gotowości i WŁASNĄ flagę
 * „wysłane" — jeden kanał nigdy nie blokuje ani nie podszywa się pod drugi. Test tego
 * dokładnego scenariusza (fbq gotowe później niż gtag i odwrotnie): `scripts/test-tracking.ts`.
 */

import { normalizeEmail, toE164PL } from "./tracking-format";

export type TrackKey =
  | "quiz_start"
  | "lead"
  | "view_item"
  | "sign_up"
  | "contact"
  | "lead_magnet"
  | "begin_checkout";

type MetaMethod = "track" | "trackCustom";

type ParamsOut = { metaParams: Record<string, unknown>; ga4Params: Record<string, unknown> };

interface EventDef {
  /** `null` = zdarzenie GA4-only, nic nie idzie do Mety (patrz decyzja niżej o `form_start`). */
  meta: { method: MetaMethod; name: string } | null;
  /** `null` = zdarzenie Meta-only. */
  ga4Name: string | null;
  /** Tylko `lead` odpala konwersję Google Ads (etykieta z `/api/analytics-config`). */
  adsConversion?: boolean;
  /** Domyślnie te same parametry lecą do obu platform. Nadpisz, gdy nazwy pól mają się różnić
   * (np. `lead`: Meta dostaje `content_name`, GA4 dostaje `lead_source`). */
  toParams?: (ctx: Record<string, unknown>) => ParamsOut;
}

function identity(ctx: Record<string, unknown>): ParamsOut {
  return { metaParams: ctx, ga4Params: ctx };
}

/**
 * 🔴 ŚWIADOMIE BRAK WPISU „form_start": korekta CEO 29.09 po sprawdzeniu w panelu GA4 —
 * pomiar zaawansowany (Enhanced Measurement) GA4 wysyła `form_start`/`form_submit`
 * SAM, automatycznie (widać 74/21 zdarzeń w panelu). Własna implementacja zdublowałaby
 * nazwę zdarzenia zarezerwowaną przez pomiar zaawansowany — GA4 zsumowałby dwa źródła
 * pod jedną nazwą i liczby przestałyby się zgadzać z rzeczywistością. Nie dotykać.
 */
export const TRACK_EVENTS: Record<TrackKey, EventDef> = {
  quiz_start: {
    // `trackCustom`, NIE `track` — "QuizStart" nie jest standardowym zdarzeniem Meta.
    // Zdarzenia standardowe (`track`) trafiają do biblioteki zdarzeń Menedżera Reklam
    // i tylko one liczą się jako cele optymalizacji; custom są widoczne, ale osobno.
    meta: { method: "trackCustom", name: "QuizStart" },
    ga4Name: "quiz_start",
  },
  lead: {
    meta: { method: "track", name: "Lead" },
    ga4Name: "generate_lead",
    adsConversion: true,
    toParams: (ctx) => {
      const source = ctx.source === "quiz" ? "quiz" : "formularz";
      const shared: Record<string, unknown> = {};
      if (ctx.wojewodztwo) shared.wojewodztwo = ctx.wojewodztwo;
      if (ctx.kategoria) shared.kategoria = ctx.kategoria;
      return {
        // Meta: `content_name` jest standardowym parametrem — widać wprost w Menedżerze Reklam.
        metaParams: { ...shared, content_name: source === "quiz" ? "quiz-kwalifikacyjny" : "formularz" },
        // GA4: `lead_source` to WŁASNY parametr niestandardowy (do zarejestrowania jako
        // custom dimension w GA4, razem z `wojewodztwo`/`kategoria` — patrz docs/zdarzenia-analityczne.md).
        ga4Params: { ...shared, lead_source: source },
      };
    },
  },
  view_item: {
    meta: { method: "track", name: "ViewContent" },
    ga4Name: "view_item",
  },
  sign_up: {
    meta: { method: "track", name: "SubmitApplication" },
    ga4Name: "sign_up",
  },
  contact: {
    meta: { method: "track", name: "Contact" },
    ga4Name: "contact",
  },
  lead_magnet: {
    meta: { method: "track", name: "CompleteRegistration" },
    ga4Name: "lead_magnet",
  },
  begin_checkout: {
    meta: { method: "track", name: "InitiateCheckout" },
    ga4Name: "begin_checkout",
  },
};

export type UbAnalyticsConfig = {
  ga4: string | null;
  pixel: string | null;
  adsId: string | null;
  adsLeadLabel: string | null;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    __ubAnalytics?: UbAnalyticsConfig;
    /** Dedup w obrębie jednej sesji przeglądarki: `"<klucz>:<eventId>:<kanał>"`. Chroni przed
     * podwójnym strzałem z React StrictMode (dev montuje efekty dwa razy) i przed powtórnym
     * wywołaniem `trackEvent` z tym samym `eventId` (np. przycisk kliknięty dwa razy). */
    __ubFiredEvents?: Set<string>;
  }
}

/**
 * Odpala zdarzenie na WSZYSTKICH skonfigurowanych platformach — ale KAŻDĄ NIEZALEŻNIE.
 *
 * Skrypty (fbq/gtag) i identyfikatory (`window.__ubAnalytics`, dociągane osobnym fetchem
 * w `Analytics.tsx`) ładują się asynchronicznie i w nieprzewidywalnej kolejności względem
 * siebie. Ta funkcja odpytuje co 250 ms przez maks. 10 s i strzela do danego kanału W CHWILI,
 * gdy TEN kanał (jego skrypt + jego ID) jest gotowy — nie czeka na pozostałe i nie daje się
 * zablokować przez wolniejszy kanał. Kanał, którego w ogóle nie ma w mapie zdarzenia
 * (np. `sign_up` nie ma konwersji Ads), liczy się jako "gotowy" od razu, więc nie wydłuża pętli.
 */
export interface TrackEventOptions {
  eventId?: string;
  /**
   * Google Ads enhanced conversions — dane kontaktowe SUROWE (gtag hashuje sam po stronie
   * klienta). Ustawiane `gtag('set','user_data',...)` w TEJ SAMEJ chwili, gdy kanał "ads"
   * jest gotowy do strzału (ten sam warunek gotowości, ta sama pętla) — dzięki temu nie ma
   * osobnego wyścigu o to, czy `gtag` już istnieje w chwili wywołania z komponentu.
   * Tylko dla zdarzeń z `adsConversion: true` (dziś: `lead`).
   */
  adsUserData?: { email: string; phone: string };
}

export function trackEvent(key: TrackKey, ctx: Record<string, unknown> = {}, opts: TrackEventOptions = {}): void {
  if (typeof window === "undefined") return;
  const def = TRACK_EVENTS[key];
  if (!def) return;

  const dedupePrefix = opts.eventId ? `${key}:${opts.eventId}:` : null;
  if (dedupePrefix) window.__ubFiredEvents = window.__ubFiredEvents || new Set();

  const done = {
    meta: !def.meta,
    ga4: !def.ga4Name,
    ads: !def.adsConversion,
  };

  const alreadyMarked = (channel: "meta" | "ga4" | "ads") =>
    dedupePrefix != null && window.__ubFiredEvents!.has(dedupePrefix + channel);
  const mark = (channel: "meta" | "ga4" | "ads") => {
    if (dedupePrefix) window.__ubFiredEvents!.add(dedupePrefix + channel);
  };

  const started = Date.now();

  const tick = (): boolean => {
    const cfg = window.__ubAnalytics;
    const { metaParams, ga4Params } = def.toParams ? def.toParams(ctx) : identity(ctx);

    if (!done.meta && def.meta && typeof window.fbq === "function" && cfg?.pixel) {
      if (!alreadyMarked("meta")) {
        window.fbq(def.meta.method, def.meta.name, metaParams, opts.eventId ? { eventID: opts.eventId } : undefined);
        mark("meta");
      }
      done.meta = true;
    }

    if (!done.ga4 && def.ga4Name && typeof window.gtag === "function" && cfg?.ga4) {
      if (!alreadyMarked("ga4")) {
        window.gtag("event", def.ga4Name, ga4Params);
        mark("ga4");
      }
      done.ga4 = true;
    }

    if (!done.ads && def.adsConversion && typeof window.gtag === "function" && cfg?.adsId && cfg?.adsLeadLabel) {
      if (!alreadyMarked("ads")) {
        if (opts.adsUserData) {
          window.gtag("set", "user_data", {
            email: normalizeEmail(opts.adsUserData.email),
            phone_number: toE164PL(opts.adsUserData.phone),
          });
        }
        window.gtag("event", "conversion", {
          send_to: `${cfg.adsId}/${cfg.adsLeadLabel}`,
          // `transaction_id` daje Google Ads WŁASNY klucz deduplikacji — niezależny od Meta,
          // ale tym samym `eventId`, więc jeden numer sprawy spina oba systemy.
          ...(opts.eventId ? { transaction_id: opts.eventId } : {}),
        });
        mark("ads");
      }
      done.ads = true;
    }

    return done.meta && done.ga4 && done.ads;
  };

  if (tick()) return;
  const timer = window.setInterval(() => {
    if (tick() || Date.now() - started > 10_000) {
      window.clearInterval(timer);
    }
  }, 250);
}
