"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; exact?: boolean };

/**
 * Panel obsługuje DWA rozłączne lejki i nawigacja ma to pokazywać na pierwszy rzut oka:
 * — CRM Kursantki: leady B2C, które sprzedajemy trenerkom,
 * — CRM Trenerki: pozyskiwanie akademii jako klientów B2B (to one płacą).
 * Katalog trenerek siedzi w drugiej grupie, bo to wynik lejka B2B, nie osobny świat.
 */
const GROUPS: { label: string | null; items: Item[] }[] = [
  {
    label: null,
    items: [{ href: "/admin", label: "Dashboard", exact: true }],
  },
  {
    label: "CRM Kursantki",
    items: [
      { href: "/admin/leady", label: "Leady" },
      { href: "/admin/zgloszenia", label: "Zgłoszenia" },
      { href: "/admin/rozliczenia", label: "Rozliczenia" },
    ],
  },
  {
    label: "CRM Trenerki",
    items: [
      { href: "/admin/crm-trenerki", label: "CRM trenerki" },
      { href: "/admin/crm-trenerki/kolejka", label: "Kolejka researchu" },
      { href: "/admin/trenerki", label: "Katalog trenerek" },
      { href: "/admin/szkolenia", label: "Szkolenia" },
    ],
  },
  {
    label: "Serwis",
    items: [
      { href: "/admin/blog", label: "Blog" },
      { href: "/admin/ustawienia", label: "Ustawienia" },
    ],
  },
];

function isActive(pathname: string, item: Item): boolean {
  if (item.exact) return pathname === item.href;
  // „CRM trenerki" nie może się podświetlać, gdy jesteśmy w kolejce researchu (zagnieżdżona trasa).
  if (item.href === "/admin/crm-trenerki") {
    return pathname === "/admin/crm-trenerki" || /^\/admin\/crm-trenerki\/(?!kolejka)/.test(pathname);
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Nawigacja panelu" className="space-y-5">
      {GROUPS.map((group, gi) => (
        <div key={group.label ?? `grupa-${gi}`}>
          {group.label && (
            <p className="px-4 pb-1.5 text-[11px] font-bold uppercase tracking-[1.5px] text-sand-300/70">
              {group.label}
            </p>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-sand-400 text-ink-soft" : "text-sand-200/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
