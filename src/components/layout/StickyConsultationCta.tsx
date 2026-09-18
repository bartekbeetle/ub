"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Pasek „Bezpłatna Konsultacja" przyklejony do dołu na mobile (`md:hidden` — na desktopie
 * nie istnieje). Ukryty na `/aplikacja`: to jest strona z WŁASNYM, jedynym słusznym CTA („Dalej" /
 * „Aplikuj o dofinansowanie"), a drugi, konkurencyjny przycisk zaklejony na dole ekranu
 * odciąga uwagę od dokończenia quizu — i fizycznie zabiera miejsce, które i tak jest
 * ciasne na telefonie (13.09.2026, audyt mobile przed startem płatnego ruchu Meta).
 */
export function StickyConsultationCta() {
  const pathname = usePathname();
  if (pathname?.startsWith("/aplikacja")) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <Link href="/konsultacja" className="btn-primary w-full !py-3 text-center">
          Bezpłatna Konsultacja
        </Link>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </>
  );
}
