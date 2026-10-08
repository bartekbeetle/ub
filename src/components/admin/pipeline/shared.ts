/** Wspólne drobiazgi kart CRM admina (komponenty klienckie). */
const ymdFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" });

export function daysAgo(iso: string): string {
  const a = Date.parse(`${ymdFmt.format(new Date(iso))}T00:00:00Z`);
  const b = Date.parse(`${ymdFmt.format(new Date())}T00:00:00Z`);
  const d = Math.max(0, Math.round((b - a) / 86_400_000));
  return d === 0 ? "dziś" : d === 1 ? "wczoraj" : `${d} dn. temu`;
}

/** `tel:` chce samych cyfr i ewentualnego `+`. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export type BoardOption = { id: number; label: string; category: string };
