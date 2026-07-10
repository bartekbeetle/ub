import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";

const SESSION_COOKIE = "ub_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8h

function hashToken(token: string): string {
  return createHash("sha256").update(token + (process.env.SESSION_SECRET || "")).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

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

/** Guard dla API admina — zwraca usera albo null (handler zwraca 401). */
export async function requireAdmin(): Promise<User | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}
