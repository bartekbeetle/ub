"use client";

import { useEffect } from "react";

type UbAnalytics = {
  ga4: string | null;
  pixel: string | null;
  adsId: string | null;
  adsLeadLabel: string | null;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    __ubAnalytics?: UbAnalytics;
  }
}

/**
 * Mapowanie zdarzeń Meta → GA4. GA4 ma własny słownik nazw zdarzeń rekomendowanych
 * i tylko one wchodzą do raportów konwersji bez ręcznej konfiguracji.
 */
const GA4_EVENT: Record<string, string> = {
  Lead: "generate_lead",
  ViewContent: "view_item",
};

/**
 * Odpala zdarzenie konwersji w Meta Pixel + GA4 + Google Ads (Lead na /dziekujemy,
 * ViewContent na kursie).
 *
 * Dlaczego pętla, a nie zwykłe `if (fbq)`: skrypty analityki ładują się dopiero PO zgodzie
 * z banera cookies, a ich identyfikatory są dociągane osobnym fetchem z `/api/analytics-config`.
 * Ten komponent montuje się razem ze stroną, więc przy pierwszym renderze `fbq`/`gtag` zwykle
 * jeszcze nie istnieją i zdarzenie przepadało bez śladu. Czekamy do 10 s, sprawdzając co 250 ms.
 */
export function TrackEvent({ event, params }: { event: string; params?: Record<string, unknown> }) {
  useEffect(() => {
    let done = false;
    const started = Date.now();

    const fire = (force = false) => {
      if (done) return true;
      const cfg = window.__ubAnalytics;
      const hasFbq = typeof window.fbq === "function";
      const hasGtag = typeof window.gtag === "function";
      // Nic jeszcze nie wstało — czekamy dalej.
      if (!hasFbq && !hasGtag) return false;
      // Skrypty już są, ale identyfikatory dociągają się osobnym fetchem. Gdybyśmy strzelili
      // teraz, zdarzenie poszłoby BEZ konwersji Google Ads (`send_to` wymaga etykiety z cfg)
      // i oznaczyli byśmy je jako wysłane. Czekamy na komplet — timeout niżej i tak zwolni.
      if (!cfg && !force) return false;

      if (hasFbq) window.fbq!("track", event, params ?? {});

      if (hasGtag) {
        const ga4Event = GA4_EVENT[event];
        if (ga4Event && cfg?.ga4) window.gtag!("event", ga4Event, params ?? {});
        // Google Ads liczy konwersję tylko po pełnym `send_to` (konto/etykieta akcji).
        if (event === "Lead" && cfg?.adsId && cfg?.adsLeadLabel) {
          window.gtag!("event", "conversion", { send_to: `${cfg.adsId}/${cfg.adsLeadLabel}` });
        }
      }

      done = true;
      return true;
    };

    if (fire()) return;
    const timer = window.setInterval(() => {
      if (fire()) return window.clearInterval(timer);
      // Po limicie strzelamy tym, co jest — lepiej zdarzenie bez konwersji Google Ads
      // niż całkiem zgubiony lead (np. gdy `/api/analytics-config` nie odpowiedziało).
      if (Date.now() - started > 10_000) {
        fire(true);
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [event, params]);

  return null;
}
