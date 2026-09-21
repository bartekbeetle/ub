"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/panel/start", label: "Start" },
  { href: "/panel/leady", label: "Moje kursantki" },
  { href: "/panel/rozliczenia", label: "Rozliczenia" },
  { href: "/panel/profil", label: "Mój profil" },
];

/**
 * `pending` = konto po samodzielnej rejestracji, przed aktywacją. Chowamy wtedy zakładki
 * z danymi kursantek — nie dlatego, że to zabezpieczenie (tym są bramki serwerowe w stronach
 * i w API), tylko dlatego, że link prowadzący zawsze do przekierowania wygląda jak awaria.
 */
export function PanelNav({ pending = false }: { pending?: boolean }) {
  const pathname = usePathname();
  const items = pending ? NAV.filter((i) => i.href === "/panel/start" || i.href === "/panel/profil") : NAV;
  return (
    <nav aria-label="Nawigacja panelu trenerki" className="space-y-1">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-sand-400 text-ink-soft" : "text-sand-200/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
