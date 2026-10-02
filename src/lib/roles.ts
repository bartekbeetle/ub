/**
 * Role w panelu — JEDNO miejsce, które wie, kto jest „administracją".
 *
 * Czysty moduł (bez `server-only`, bez bazy), żeby importował go i serwer, i komponent
 * kliencki (nawigacja), i skrypt testowy. Każda bramka w aplikacji ma pytać tutaj,
 * a nie porównywać `role === "admin"` — inaczej superadmin wyleciałby z własnego panelu.
 */
export type UserRole = "admin" | "trenerka" | "superadmin";

/** Admin operacyjny ALBO superadmin — przechodzi każdą zwykłą bramkę panelu. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

/** Pola rozliczeniowe (przydziały: `amount`, `billingStatus`; trenerki: `rate`, `billingModel`). */
const BILLING_FIELDS = ["amount", "billingStatus", "rate", "billingModel"] as const;

/**
 * Zwraca kopię obiektu BEZ pól rozliczeniowych, gdy rola to nie superadmin.
 * Używaj w KAŻDEJ odpowiedzi `/api/admin/*`, która oddaje wiersz `lead_assignments` albo `trainers`
 * (np. wynik `.returning()`), bo zwykły admin nie ma widzieć stawek ani kwot.
 */
export function stripBilling<T extends Record<string, unknown>>(
  row: T,
  role: string | null | undefined
): T | Omit<T, (typeof BILLING_FIELDS)[number]> {
  if (isSuperadminRole(role)) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const f of BILLING_FIELDS) delete copy[f];
  return copy as Omit<T, (typeof BILLING_FIELDS)[number]>;
}

/** Właściciel: rozliczenia, ustawienia, zarządzanie zespołem i dziennik zmian. */
export function isSuperadminRole(role: string | null | undefined): boolean {
  return role === "superadmin";
}

/**
 * Ścieżki panelu zarezerwowane dla superadmina. Layout przekierowuje po tej liście,
 * a każda z tych stron dodatkowo wywołuje `requireSuperadminPage()` (obrona w głąb —
 * strona i layout renderują się równolegle, więc samo przekierowanie z layoutu nie
 * powstrzymałoby strony przed zapytaniem do bazy).
 */
export const SUPERADMIN_ONLY_PREFIXES = ["/admin/rozliczenia", "/admin/ustawienia", "/admin/zespol"] as const;

export function isSuperadminOnlyPath(pathname: string): boolean {
  return SUPERADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Czy rola może wejść na ścieżkę panelu admina. */
export function canAccessAdminPath(role: string | null | undefined, pathname: string): boolean {
  if (!isAdminRole(role)) return false;
  if (isSuperadminOnlyPath(pathname)) return isSuperadminRole(role);
  return true;
}

/** Konto wyłączone (`is_active = false`) nie loguje się i nie ma ważnej sesji. */
export function canSignIn(user: { isActive: boolean } | null | undefined): boolean {
  return Boolean(user && user.isActive);
}
