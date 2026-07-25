"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONSENT_EVENT, readConsent, writeConsent, type ConsentState } from "@/lib/consent";

/**
 * Baner zgody cookies.
 *
 * Wymogi, które musi spełniać (i spełnia):
 * - „Akceptuję" i „Odrzucam" są równorzędne wizualnie — ukrycie odmowy pod linkiem albo szarym
 *   tekstem jest traktowane jako wymuszenie zgody (wytyczne EDPB, decyzje UODO).
 * - Brak decyzji = brak zgody. Zamknięcie banera bez wyboru nie zwalnia śledzenia.
 * - Zgodę da się wycofać tak łatwo, jak jej udzielić — link „Ustawienia cookies" w stopce
 *   przywraca baner (zdarzenie `ub-open-consent`).
 */
export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentState>("granted"); // domyślnie nie migamy banerem przed hydracją
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
    const reopen = () => setConsent(null);
    window.addEventListener("ub-open-consent", reopen);
    return () => window.removeEventListener("ub-open-consent", reopen);
  }, []);

  if (!ready || consent !== null) return null;

  const decide = (state: "granted" | "denied") => {
    writeConsent(state);
    setConsent(state);
  };

  return (
    <div
      role="dialog"
      aria-label="Zgoda na pliki cookies"
      // bottom-20 na mobile, żeby nie zasłonić sticky CTA konsultacji
      className="fixed inset-x-0 bottom-20 z-50 px-3 md:bottom-4"
    >
      <div className="mx-auto max-w-3xl rounded-xl border border-sand-200 bg-white p-5 shadow-lg md:p-6">
        <p className="font-serif text-lg font-semibold">Pliki cookies</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Używamy cookies niezbędnych do działania serwisu. Za Twoją zgodą korzystamy też z cookies
          analitycznych i marketingowych (Google Analytics, Meta Pixel), żeby wiedzieć, które treści są
          przydatne i komu pokazywać nasze reklamy. Zgodę możesz wycofać w każdej chwili.{" "}
          <Link href="/polityka-cookies" className="link-inline">
            Polityka cookies
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => decide("granted")} className="btn-primary flex-1 !py-2.5">
            Akceptuję wszystkie
          </button>
          <button type="button" onClick={() => decide("denied")} className="btn-outline flex-1 !py-2.5">
            Tylko niezbędne
          </button>
        </div>
      </div>
    </div>
  );
}

/** Link „Ustawienia cookies" — wycofanie zgody musi być tak łatwe jak jej udzielenie. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        try {
          window.localStorage.removeItem("ub_consent_v1");
        } catch {
          /* ignore */
        }
        window.dispatchEvent(new CustomEvent("ub-open-consent"));
        window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: "denied" }));
      }}
    >
      Ustawienia cookies
    </button>
  );
}
