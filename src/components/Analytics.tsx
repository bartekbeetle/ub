"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { CONSENT_EVENT, readConsent, type ConsentState } from "@/lib/consent";

/** Wartości z buildu — działają tylko wtedy, gdy obraz był budowany z build-argami. */
const BUILD_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const BUILD_GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || "";

type Ids = { ga4: string | null; pixel: string | null };

/**
 * Meta Pixel + GA4 — ładują się WYŁĄCZNIE po zgodzie z banera cookies.
 * Wcześniej na stronie nie ma ani jednego skryptu śledzącego: samo wczytanie pikselu
 * (nawet bez zdarzeń) zapisuje cookie i jest przetwarzaniem wymagającym zgody.
 *
 * Identyfikatory: najpierw z buildu (`NEXT_PUBLIC_*`), a jeśli ich nie ma — dociągane
 * z `/api/analytics-config` w runtime. Powód w komentarzu tamtego pliku: w obrazie
 * dockerowym `NEXT_PUBLIC_*` zapieka się przy buildzie i na produkcji było puste,
 * przez co analityka nie strzelała mimo ustawionych zmiennych.
 */
export function Analytics() {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [ids, setIds] = useState<Ids>({ ga4: BUILD_GA4_ID || null, pixel: BUILD_PIXEL_ID || null });
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
    if (ids.ga4 || ids.pixel) return; // wartości z buildu wystarczą
    fetched.current = true;
    fetch("/api/analytics-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ga4Id?: string | null; pixelId?: string | null } | null) => {
        if (d) setIds({ ga4: d.ga4Id ?? null, pixel: d.pixelId ?? null });
      })
      .catch(() => {
        /* brak konfiguracji analityki nie może wywalić strony */
      });
  }, [consent, ids.ga4, ids.pixel]);

  if (consent !== "granted") return null;

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
      {ids.ga4 ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ids.ga4}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ids.ga4}', { anonymize_ip: true });`}
          </Script>
        </>
      ) : null}
    </>
  );
}
