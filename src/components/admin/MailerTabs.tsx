import Link from "next/link";

const TABS = [
  { key: "pulpit", href: "/admin/mailing", label: "Pulpit" },
  { key: "kampanie", href: "/admin/mailing/kampanie", label: "Kampanie" },
  { key: "automatyzacje", href: "/admin/mailing/automatyzacje", label: "Automatyzacje" },
  { key: "wyslane", href: "/admin/mailing/wyslane", label: "Wysłane" },
] as const;

export type MailerTab = (typeof TABS)[number]["key"];

/** Zakładki sekcji Mailing — jak w MailerLite: pulpit, kampanie, automatyzacje + dziennik wysłanych. */
export function MailerTabs({ active }: { active: MailerTab }) {
  return (
    <nav aria-label="Mailing" className="mt-4 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`press rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-150 ${
            t.key === active ? "bg-sand-400 text-ink-soft" : "bg-sand-100 text-sand-700 hover:bg-sand-200"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
