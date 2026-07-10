"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/leady", label: "Leady" },
  { href: "/admin/rozliczenia", label: "Rozliczenia" },
  { href: "/admin/trenerki", label: "Trenerki" },
  { href: "/admin/szkolenia", label: "Szkolenia" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/zgloszenia", label: "Zgłoszenia" },
  { href: "/admin/ustawienia", label: "Ustawienia" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Nawigacja panelu" className="space-y-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
