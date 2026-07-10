"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/panel/leady", label: "Moje leady" },
  { href: "/panel/rozliczenia", label: "Rozliczenia" },
  { href: "/panel/profil", label: "Mój profil" },
];

export function PanelNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Nawigacja panelu trenerki" className="space-y-1">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-sand-400 text-white" : "text-sand-200/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
