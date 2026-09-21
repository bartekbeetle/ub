export function slugify(text: string): string {
  const map: Record<string, string> = {
    ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
    Ą: "a", Ć: "c", Ę: "e", Ł: "l", Ń: "n", Ó: "o", Ś: "s", Ź: "z", Ż: "z",
  };
  return text
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatPln(amount: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(amount) + " zł";
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return "•••";
  return phone.slice(0, 3) + " ••• •• " + phone.slice(-2);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return (local[0] ?? "") + "•••@" + domain;
}

/** CSV z BOM (Excel + polskie znaki) */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Neutralizacja CSV/Formula Injection: dane leadów pochodzą z publicznego formularza,
    // a admin otwiera eksport w Excelu/LibreOffice. Komórka zaczynająca się od = + - @ (albo
    // tab/CR) jest tam traktowana jak formuła — spreparowany `name` mógłby wykonać DDE/link
    // phishingowy. Poprzedzamy ją apostrofem, który arkusze traktują jako „to jest tekst".
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}
