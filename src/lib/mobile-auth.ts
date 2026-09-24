import "server-only";
import { randomBytes } from "crypto";
import { eq, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hashToken, SESSION_TTL_MS } from "@/lib/auth";
import type { Trainer, User } from "@/db/schema";

/**
 * WARSTWA AUTORYZACJI DLA APLIKACJI MOBILNEJ (Expo) — CELOWO OSOBNA OD COOKIE.
 *
 * Dlaczego nie dopisaliśmy obsługi nagłówka `Authorization` do `getSessionUser`:
 * ta jedna funkcja bramkuje panel admina, panel trenerki i każdą trasę API, a za nią
 * leżą dane osobowe kursantek. Audyt z 21.09 wyszedł dokładnie na tej klasie błędu
 * (bramka wymuszenia hasła istniała tylko na froncie, a dane i tak wychodziły).
 * Dlatego ścieżka mobilna jest DOPISANA obok: żadna linia kodu wykonywana przez
 * panel webowy się nie zmienia, a jedyny wspólny element to `hashToken`.
 *
 * Token to ten sam materiał co w cookie (32 losowe bajty), trzymany w bazie jako sha256.
 * W telefonie leży w `expo-secure-store` (Keychain / Keystore), nie w AsyncStorage.
 * CSRF nie dotyczy tej ścieżki — przeglądarka nie dokleja nagłówka `Authorization` sama.
 *
 * TTL: 8 h, tak samo jak sesja webowa. Świadoma decyzja na pilotaż — trenerka loguje się
 * raz dziennie. Refresh tokenów NIE budujemy, dopóki nie ma podpisanych akademii.
 */

export type MobileAuth = { user: User; trainer: Trainer };

/** Wydaje token sesji i zwraca go w surowej postaci (cookie NIE jest ustawiane). */
export async function createMobileSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
}

/**
 * Guard aplikacji mobilnej. Odwzorowuje komplet warunków z `requireTrainer`:
 * rola `trenerka`, przypisany `trainerId`, brak `mustChangePassword`
 * (poza trasą zmiany hasła — inaczej mechanizm naprawy blokowałby sam siebie),
 * aktywne konto użytkownika i nieprzeterminowana sesja.
 *
 * Dodatkowo zwraca rekord trenerki, bo bramka onboardingu (`trainers.isActive`)
 * jest sprawdzana przez KAŻDĄ trasę oddającą dane kursantek.
 */
export async function requireTrainerMobile(
  req: Request,
  opts?: { allowPasswordChange?: boolean }
): Promise<MobileAuth | null> {
  const token = bearerToken(req);
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

  const user = row.user;
  if (user.role !== "trenerka" || !user.trainerId) return null;
  if (user.mustChangePassword && !opts?.allowPasswordChange) return null;

  const [trainer] = await db
    .select()
    .from(schema.trainers)
    .where(eq(schema.trainers.id, user.trainerId))
    .limit(1);
  if (!trainer) return null;

  return { user, trainer };
}

/** Kasuje sesję przypisaną do tokenu z nagłówka (wylogowanie z telefonu). */
export async function destroyMobileSession(req: Request): Promise<void> {
  const token = bearerToken(req);
  if (!token) return;
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
}

/** Komunikat bramki onboardingu — jeden tekst dla wszystkich tras mobilnych. */
export const ONBOARDING_GATE_MESSAGE =
  "Konto czeka na aktywację. Skontaktujemy się telefonicznie przed pierwszym zgłoszeniem.";
