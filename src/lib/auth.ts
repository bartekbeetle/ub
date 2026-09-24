import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";

const SESSION_COOKIE = "ub_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8h

/**
 * Eksportowane wyłącznie po to, żeby warstwa mobilna (`src/lib/mobile-auth.ts`) liczyła
 * identyfikator sesji DOKŁADNIE tak samo — duplikat tej funkcji po drugiej stronie
 * rozjechałby się przy pierwszej zmianie i dawałby ciche 401 zamiast głośnego błędu.
 * Sama zmiana to dopisanie `export`: żadna istniejąca ścieżka (cookie, panel, admin)
 * nie zmienia zachowania.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token + (process.env.SESSION_SECRET || "")).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hash-atrapa (bcrypt cost 12) do porównania stałoczasowego, gdy logowanie nie znajdzie konta.
 * Bez tego `bcrypt.compare` odpalał się TYLKO dla istniejącego e-maila, więc odpowiedź dla
 * nieistniejącego wracała mierzalnie szybciej — furtka do enumeracji kont (audyt 21.09).
 * Trasy logowania mają zawsze wykonać jedno porównanie bcrypt, niezależnie od istnienia usera.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$hFuicGs4bO7dnukHFypQ1.EB48b8.BmfaIMQeC05mN910TaBQQXu6";

export async function createSession(userId: number): Promise<void> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  // sprzątanie wygasłych sesji
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Kasuje WSZYSTKIE sesje danego użytkownika. Wołane po zmianie hasła: skradziony cookie
 * (np. z przejętego urządzenia) przestaje działać natychmiast, zamiast żyć pełne 8h TTL
 * mimo „zabezpieczenia się" przez właściciela (audyt 21.09). Bieżące urządzenie dostaje
 * świeżą sesję osobnym `createSession`, więc zmieniający hasło nie wylatuje z panelu.
 */
export async function invalidateUserSessions(userId: number): Promise<void> {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ user: schema.users, session: schema.sessions })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.id, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt < new Date() || !row.user.isActive) return null;
  return row.user;
}

/**
 * Konto z ustawionym `mustChangePassword` (hasło startowe z seeda) NIE dostaje dostępu
 * do żadnych danych — dopóki nie ustawi własnego hasła. Wcześniej blokował to wyłącznie
 * baner na froncie (`ForcePasswordChange`), a API i Server Components wydawały dane mimo
 * domyślnego hasła. Ponieważ hasło startowe było wspólne i zaszyte w repo, a loginy
 * trenerek dają się wyliczyć z publicznych nazw, była to gotowa furtka do PII kursantek.
 *
 * `allowPasswordChange` przepuszcza WYŁĄCZNIE trasę zmiany hasła — inaczej użytkownik
 * z hasłem startowym nie mógłby go zmienić (mechanizm naprawy blokowałby sam siebie).
 */
type GuardOpts = { allowPasswordChange?: boolean };

/** Guard dla API admina — zwraca usera albo null (handler zwraca 401). */
export async function requireAdmin(opts?: GuardOpts): Promise<User | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  if (user.mustChangePassword && !opts?.allowPasswordChange) return null;
  return user;
}

/** Guard dla API panelu trenerki — zwraca usera tylko gdy rola trenerka i ma przypisany trainerId. */
export async function requireTrainer(opts?: GuardOpts): Promise<User | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "trenerka" || !user.trainerId) return null;
  if (user.mustChangePassword && !opts?.allowPasswordChange) return null;
  return user;
}
