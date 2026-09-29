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
  // Strona płatnego poradnika ma własny przycisk zakupu — drugi, przyklejony CTA rozprasza decyzję.
  if (pathname?.startsWith("/poradnik-wlasny-salon")) return null;

  // Na stronie kursu treść (opis, program, co zawiera cena) jest długa, a jedyne realne CTA
  // („Aplikuj o dofinansowanie" w karcie rezerwacji) na mobile ląduje DOPIERO pod całą treścią,
  // bo `lg:sticky` na tej karcie nie działa poniżej `lg`. Zamiast generycznej „Bezpłatnej
  // Konsultacji" pasek pokazuje TĘ SAMĄ etykietę i prowadzi do TEGO SAMEGO quizu co karta
  // rezerwacji — użytkowniczka czytająca o konkretnym kursie trafia do aplikacji na ten kurs,
  // nie do ogólnej rozmowy (audyt mobile 29.09.2026).
  const kursMatch = pathname?.match(/^\/kurs\/([^/]+)/);
  const href = kursMatch ? `/aplikacja?kurs=${kursMatch[1]}` : "/konsultacja";
  const label = kursMatch ? "Aplikuj o dofinansowanie" : "Bezpłatna Konsultacja";

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <Link href={href} className="btn-primary w-full !py-3 text-center">
          {label}
        </Link>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </>
  );
}
