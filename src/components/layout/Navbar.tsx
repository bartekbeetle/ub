"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMenu, IconX, IconSearch } from "@/components/icons";

const LINKS = [
  { href: "/kursy", label: "Szkolenia" },
  { href: "/dofinansowania", label: "Dofinansowania" },
  { href: "/trenerki", label: "Trenerki" },
  { href: "/blog", label: "Baza Wiedzy" },
  { href: "/kontakt", label: "Kontakt" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-sand-100 bg-cream/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:h-20 md:px-6" aria-label="Główna nawigacja">
        <Link href="/" className="font-serif text-lg font-bold tracking-[3px] text-ink-soft md:text-xl" aria-label="Uniwersytet Beauty — strona główna">
          UNIWERSYTET <span className="text-sand-500">BEAUTY</span>
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-semibold transition-colors hover:text-sand-700 ${
                pathname.startsWith(l.href) ? "text-sand-700" : "text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/kursy" aria-label="Szukaj kursu" className="p-2 text-ink hover:text-sand-700 transition-colors">
            <IconSearch />
          </Link>
          <Link href="/konsultacja" className="btn-primary !px-5 !py-2.5 !text-sm">
            Bezpłatna Konsultacja
          </Link>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Zamknij menu" : "Otwórz menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <IconX width={24} height={24} /> : <IconMenu width={24} height={24} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-sand-100 bg-cream px-4 pb-6 pt-2 lg:hidden">
          <ul className="space-y-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-semibold text-ink hover:bg-sand-50"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/konsultacja" onClick={() => setOpen(false)} className="btn-primary mt-4 w-full">
            Bezpłatna Konsultacja
          </Link>
        </div>
      )}
    </header>
  );
}
