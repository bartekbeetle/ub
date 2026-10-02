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
