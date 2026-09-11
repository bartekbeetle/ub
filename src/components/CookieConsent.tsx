"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CONSENT_ALL,
  CONSENT_NONE,
  clearConsent,
  readConsent,
  writeConsent,
  type ConsentPrefs,
  type ConsentState,
} from "@/lib/consent";

const OPEN_EVENT = "ub-open-consent";

/**
 * Baner zgody cookies.
 *
 * Wymogi, które musi spełniać (i spełnia):
 * - „Akceptuję wszystkie" i „Tylko niezbędne" są równorzędne wizualnie — ukrycie odmowy pod linkiem
 *   albo szarym tekstem jest traktowane jako wymuszenie zgody (wytyczne EDPB, decyzje UODO).
 * - Zgoda jest ROZDZIELONA na cele: analityka (GA4) osobno, marketing (Meta Pixel) osobno.
 *   Jeden przycisk na oba cele nie jest zgodą „konkretną" w rozumieniu art. 4 pkt 11 RODO.
 * - Brak decyzji = brak zgody. Zamknięcie banera bez wyboru nie zwalnia śledzenia.
 * - Zgodę da się wycofać tak łatwo, jak jej udzielić — link „Ustawienia cookies" w stopce
 *   przywraca baner (zdarzenie `ub-open-consent`).
 */
export function CookieConsent() {
  // domyślnie „jakaś decyzja jest", żeby baner nie mignął przed hydracją
  const [consent, setConsent] = useState<ConsentState>(CONSENT_NONE);
  const [ready, setReady] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentPrefs>(CONSENT_NONE);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
    const reopen = () => {
      setDraft(readConsent() ?? CONSENT_NONE);
      setDetailsOpen(false);
      setConsent(null);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  if (!ready || consent !== null) return null;

  const decide = (prefs: ConsentPrefs) => {
    writeConsent(prefs);
    setConsent(prefs);
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
          Używamy cookies niezbędnych do działania serwisu — te działają zawsze. Dodatkowo, wyłącznie za
          Twoją zgodą, korzystamy z cookies analitycznych (Google Analytics) i marketingowych (Meta Pixel).
          Każdą z tych zgód możesz wyrazić osobno i wycofać w każdej chwili.{" "}
          <Link href="/polityka-cookies" className="link-inline">
            Polityka cookies
          </Link>
          .
        </p>

        {detailsOpen && (
          <div className="mt-4 space-y-3 rounded-lg bg-sand-50 p-4">
            <div className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked disabled className="mt-1 h-5 w-5 shrink-0 accent-sand-500" />
              <span>
                <strong>Niezbędne</strong> — sesja logowania, zabezpieczenie formularzy.
                <span className="block text-muted">Wymagane do działania serwisu, nie można ich wyłączyć.</span>
              </span>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.analytics}
                onChange={(e) => setDraft((d) => ({ ...d, analytics: e.target.checked }))}
                className="mt-1 h-5 w-5 shrink-0 accent-sand-500"
              />
              <span>
                <strong>Analityczne</strong> — Google Analytics 4.
                <span className="block text-muted">Statystyki ruchu: które treści są przydatne.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.marketing}
                onChange={(e) => setDraft((d) => ({ ...d, marketing: e.target.checked }))}
                className="mt-1 h-5 w-5 shrink-0 accent-sand-500"
              />
              <span>
                <strong>Marketingowe</strong> — Meta Pixel (Facebook, Instagram).
                <span className="block text-muted">
                  Pomiar skuteczności reklam i dopasowanie ich odbiorców. Dane trafiają do Meta Platforms
                  Ireland Ltd.
                </span>
              </span>
            </label>
            <button type="button" onClick={() => decide(draft)} className="btn-primary w-full !py-2.5">
              Zapisz mój wybór
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => decide(CONSENT_ALL)} className="btn-primary flex-1 !py-2.5">
            Akceptuję wszystkie
          </button>
          <button type="button" onClick={() => decide(CONSENT_NONE)} className="btn-outline flex-1 !py-2.5">
            Tylko niezbędne
          </button>
          {!detailsOpen && (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="btn-outline flex-1 !py-2.5"
              aria-expanded={detailsOpen}
            >
              Ustawienia
            </button>
          )}
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
        // czyści zapisaną decyzję i gasi skrypty, zanim baner wróci z pytaniem
        clearConsent();
        window.dispatchEvent(new CustomEvent(OPEN_EVENT));
      }}
    >
      Ustawienia cookies
    </button>
  );
}
