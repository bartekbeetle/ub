"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { CONSENT_EVENT, readConsent, type ConsentState } from "@/lib/consent";

/** Wartości z buildu — działają tylko wtedy, gdy obraz był budowany z build-argami. */
const BUILD_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const BUILD_GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || "";
const BUILD_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";
const BUILD_ADS_LEAD_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL || "";

type Ids = {
  ga4: string | null;
  pixel: string | null;
  adsId: string | null;
  adsLeadLabel: string | null;
};

const BUILD_IDS: Ids = {
  ga4: BUILD_GA4_ID || null,
  pixel: BUILD_PIXEL_ID || null,
  adsId: BUILD_ADS_ID || null,
  adsLeadLabel: BUILD_ADS_LEAD_LABEL || null,
};

/**
 * Meta Pixel + GA4 + Google Ads — ładują się WYŁĄCZNIE po zgodzie z banera cookies.
 * Wcześniej na stronie nie ma ani jednego skryptu śledzącego: samo wczytanie pikselu
 * (nawet bez zdarzeń) zapisuje cookie i jest przetwarzaniem wymagającym zgody.
 *
 * Identyfikatory: najpierw z buildu (`NEXT_PUBLIC_*`), a jeśli ich nie ma — dociągane
 * z `/api/analytics-config` w runtime. Powód w komentarzu tamtego pliku: w obrazie
 * dockerowym `NEXT_PUBLIC_*` zapieka się przy buildzie i na produkcji było puste,
 * przez co analityka nie strzelała mimo ustawionych zmiennych.
 *
 * GA4 i Google Ads dzielą jeden skrypt `gtag.js` — ładujemy go raz i robimy osobny
 * `gtag('config', ...)` dla każdego identyfikatora (tak zaleca Google przy wielu tagach).
 * Identyfikatory lądują też w `window.__ubAnalytics`, żeby `TrackEvent` mógł odpalić
 * konwersję Google Ads znając etykietę akcji.
 */
export function Analytics() {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [ids, setIds] = useState<Ids>(BUILD_IDS);
  const fetched = useRef(false);

  useEffect(() => {
    setConsent(readConsent());
    const onChange = (e: Event) => setConsent((e as CustomEvent).detail as ConsentState);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    // Pytamy o konfigurację dopiero po zgodzie — bez zgody nie robimy żadnego ruchu sieciowego.
    if (consent !== "granted" || fetched.current) return;
    if (ids.ga4 || ids.pixel || ids.adsId) return; // wartości z buildu wystarczą
    fetched.current = true;
    fetch("/api/analytics-config")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            ga4Id?: string | null;
            pixelId?: string | null;
            adsId?: string | null;
            adsLeadLabel?: string | null;
          } | null
        ) => {
          if (d)
            setIds({
              ga4: d.ga4Id ?? null,
              pixel: d.pixelId ?? null,
              adsId: d.adsId ?? null,
              adsLeadLabel: d.adsLeadLabel ?? null,
            });
        }
      )
      .catch(() => {
        /* brak konfiguracji analityki nie może wywalić strony */
      });
  }, [consent, ids.ga4, ids.pixel, ids.adsId]);

  // Udostępniamy identyfikatory zdarzeniom konwersji (TrackEvent) — dopiero po zgodzie.
  useEffect(() => {
    if (consent !== "granted") return;
    window.__ubAnalytics = ids;
  }, [consent, ids]);

  if (consent !== "granted") return null;

  // Jeden `gtag.js` obsługuje i GA4, i Google Ads — ładujemy go pod pierwszy dostępny ID.
  const gtagBootId = ids.ga4 || ids.adsId;

  return (
    <>
      {ids.pixel ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${ids.pixel}');
fbq('track', 'PageView');`}
        </Script>
      ) : null}
      {gtagBootId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtagBootId}`} strategy="afterInteractive" />
          <Script id="gtag-config" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
${ids.ga4 ? `gtag('config', '${ids.ga4}', { anonymize_ip: true });` : ""}
${ids.adsId ? `gtag('config', '${ids.adsId}');` : ""}`}
          </Script>
        </>
      ) : null}
    </>
  );
}
