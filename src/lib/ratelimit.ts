// Prosty in-memory rate limiter (sliding window).
// Wystarczający dla pojedynczej instancji (Coolify, 1 kontener). Przy skalowaniu -> Redis.
// Restart kontenera zeruje liczniki — świadomie zaakceptowane na pilotaż.

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  // GC
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= windowStart)) buckets.delete(k);
    }
  }
  return true;
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * BLOKADA PER KONTO — druga warstwa obok limitu per IP (audyt 28.09).
 *
 * Limit per IP zatrzymuje jednego napastnika, ale nie brute force rozłożony na wiele
 * adresów (botnet, proxy rotacyjne): każdy adres ma własne 5 prób/min, a hasło jedno.
 * Tu liczymy nieudane logowania NA ADRES E-MAIL, niezależnie od IP.
 *
 * Liczymy dla KAŻDEGO e-maila, także nieistniejącego — inaczej odpowiedź 429 zdradzałaby,
 * że konto istnieje (enumeracja). Skutek uboczny: napastnik może na 15 min zablokować
 * cudze konto, znając e-mail. Przy 1–2 adminach i trenerkach logujących się raz dziennie
 * to tańsze ryzyko niż przejęcie konta; jeśli zacznie boleć — CAPTCHA po blokadzie.
 */
const LOCKOUT_LIMIT = 10;
const LOCKOUT_WINDOW_MS = 15 * 60_000;
const failedLogins = new Map<string, number[]>();

function lockoutKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Czy konto o tym e-mailu ma w oknie 15 min ≥10 nieudanych prób. */
export function isAccountLocked(email: string): boolean {
  const windowStart = Date.now() - LOCKOUT_WINDOW_MS;
  const recent = (failedLogins.get(lockoutKey(email)) ?? []).filter((t) => t > windowStart);
  if (recent.length === 0) failedLogins.delete(lockoutKey(email));
  else failedLogins.set(lockoutKey(email), recent);
  return recent.length >= LOCKOUT_LIMIT;
}

/** Wołane po KAŻDYM nieudanym logowaniu (złe hasło, nieistniejące lub nieaktywne konto). */
export function recordFailedLogin(email: string): void {
  const key = lockoutKey(email);
  const windowStart = Date.now() - LOCKOUT_WINDOW_MS;
  const recent = (failedLogins.get(key) ?? []).filter((t) => t > windowStart);
  recent.push(Date.now());
  failedLogins.set(key, recent);
  if (failedLogins.size > 10000) {
    for (const [k, v] of failedLogins) {
      if (v.every((t) => t <= windowStart)) failedLogins.delete(k);
    }
  }
}

/** Poprawne hasło czyści licznik — właściciel, który się pomylił, nie ciągnie kary. */
export function clearFailedLogins(email: string): void {
  failedLogins.delete(lockoutKey(email));
}

export const LOCKOUT_MESSAGE =
  "Zbyt wiele nieudanych prób logowania na to konto. Spróbuj ponownie za 15 minut.";
