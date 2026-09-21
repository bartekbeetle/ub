"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Powłoka panelu — wspólna dla `/admin` i `/panel`.
 *
 * Powód powstania (21.09.2026): oba panele miały sidebar o sztywnej szerokości 240 px
 * i treść odsuniętą o te 240 px **zawsze**, także na telefonie. Na ekranie 390 px menu
 * zajmowało 60% szerokości, a panel wisiał poza kadrem — nie dało się nic kliknąć.
 *
 * Rozwiązanie: poniżej `lg` sidebar jest szufladą wysuwaną hamburgerem z paska górnego,
 * od `lg` w górę zostaje dokładnie tak, jak było (zero zmian na desktopie).
 *
 * Dlaczego szuflada chowa się przez `-translate-x-full` + `invisible`, a nie przez
 * warunkowe renderowanie: gdyby istnienie sidebara zależało od stanu w JS, desktop
 * mrugałby przy hydratacji. `invisible` jednocześnie wyjmuje ją z kolejności tabulacji
 * i z drzewa dostępności, więc na telefonie zamknięte menu nie łapie fokusu,
 * a `lg:visible` przywraca je na dużym ekranie.
 */
export function PanelShell({
  brandHref,
  brand,
  nav,
  footer,
  children,
}: {
  brandHref: string;
  brand: React.ReactNode;
  nav: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Zamknięcie po przejściu na inną stronę. Świadomie tutaj, a nie przez przekazywanie
  // callbacków do nawigacji: ta jedna reguła obsługuje linki menu, logo i „Zmień hasło"
  // naraz, bez dotykania komponentów nawigacji.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Tło nie może się przewijać pod otwartą szufladą — inaczej zamknięcie menu
    // zostawia stronę w zupełnie innym miejscu, niż była.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Pasek górny — tylko telefon i tablet. Ma realną wysokość (nie jest nałożony
          na treść), więc nic nie chowa się pod nim przy przewijaniu. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-navy px-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Otwórz menu"
          aria-expanded={open}
          aria-controls="panel-sidebar"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-sand-200 transition-colors hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <Link
          href={brandHref}
          className="font-serif text-base font-bold tracking-[3px] text-cream-warm"
        >
          {brand}
        </Link>
      </header>

      {/* Tło szuflady. Istnieje tylko wtedy, gdy menu jest otwarte i tylko poniżej `lg`. */}
      {open && (
        <button
          type="button"
          aria-label="Zamknij menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        id="panel-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-60 max-w-[85vw] flex-col overflow-y-auto bg-navy px-3 py-6 transition-transform duration-200 motion-reduce:transition-none lg:z-30 lg:visible lg:translate-x-0 ${
          open ? "translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <Link
            href={brandHref}
            className="px-4 font-serif text-lg font-bold tracking-[3px] text-cream-warm"
          >
            {brand}
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Zamknij menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sand-200/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="mt-8 flex-1">{nav}</div>

        <div className="border-t border-white/10 pt-3">{footer}</div>
      </aside>

      {/* Odsunięcie treści obowiązuje dopiero od `lg` — na telefonie sidebar nie zajmuje
          miejsca w układzie, bo jest szufladą. */}
      <div className="lg:ml-60">
        <div className="p-4 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
