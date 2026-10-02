/**
 * Zarządzanie kontami administracji (zespół) — reguły w jednym miejscu, bez `server-only`
 * i bez singletona bazy, żeby dały się przetestować na PGlite.
 *
 * Reguły (decyzja właściciela 02.10.2026: „muszę mieć pełną kontrolę nad wszystkim"):
 * — superadmin NIE jest modyfikowalny przez nikogo przez UI (ani wyłączenie, ani zmiana hasła,
 *   ani odebranie roli);
 * — ostatni superadmin nie może zniknąć w żadnych okolicznościach (druga linia obrony,
 *   gdyby ktoś kiedyś dopuścił zmianę roli superadmina);
 * — admin operacyjny jest zarządzany wyłącznie przez superadmina (wołający sprawdza rolę
 *   przez `requireSuperadmin`, tu pilnujemy tylko stanu bazy).
 */
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/admin-audit-core";

export type TeamResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 404 | 409; error: string };

const fail = (status: 400 | 404 | 409, error: string): TeamResult<never> => ({ ok: false, status, error });

export async function listTeam(db: AnyDb) {
  return db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
      mustChangePassword: schema.users.mustChangePassword,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(inArray(schema.users.role, ["admin", "superadmin"]))
    .orderBy(schema.users.role, schema.users.createdAt);
}

export async function countActiveSuperadmins(db: AnyDb): Promise<number> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.role, "superadmin"), eq(schema.users.isActive, true)));
  return rows.length;
}

/** Tworzy konto admina z hasłem tymczasowym (już zahashowanym) i wymuszoną zmianą hasła. */
export async function createAdminUser(
  db: AnyDb,
  input: { email: string; passwordHash: string },
): Promise<TeamResult<{ id: number; email: string }>> {
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing) return fail(409, "Konto o tym adresie już istnieje.");
  const [created] = await db
    .insert(schema.users)
    .values({ email, passwordHash: input.passwordHash, role: "admin", mustChangePassword: true, isActive: true })
    .returning({ id: schema.users.id, email: schema.users.email });
  return { ok: true, data: created };
}

export type TeamAction = "disable" | "enable" | "revoke" | "reset_password";

/** Wspólna kontrola celu: musi istnieć, być adminem (nie superadminem) i nie być ostatnim superadminem. */
async function loadManageableAdmin(db: AnyDb, targetId: number): Promise<TeamResult<typeof schema.users.$inferSelect>> {
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, targetId)).limit(1);
  if (!target || (target.role !== "admin" && target.role !== "superadmin")) return fail(404, "Nie znaleziono konta w zespole.");
  if (target.role === "superadmin") {
    const last = (await countActiveSuperadmins(db)) <= 1;
    return fail(
      409,
      last
        ? "To ostatni superadmin — nie można go wyłączyć, zdegradować ani zmienić."
        : "Konta superadmina nie można zmieniać z panelu.",
    );
  }
  return { ok: true, data: target };
}

export async function applyTeamAction(
  db: AnyDb,
  targetId: number,
  action: TeamAction,
  opts?: { passwordHash?: string },
): Promise<TeamResult<{ action: TeamAction; email: string }>> {
  const loaded = await loadManageableAdmin(db, targetId);
  if (!loaded.ok) return loaded;
  const target = loaded.data;

  if (action === "enable") {
    await db.update(schema.users).set({ isActive: true }).where(eq(schema.users.id, target.id));
    return { ok: true, data: { action, email: target.email } };
  }

  if (action === "reset_password") {
    if (!opts?.passwordHash) return fail(400, "Brak hasła tymczasowego.");
    await db
      .update(schema.users)
      .set({ passwordHash: opts.passwordHash, mustChangePassword: true })
      .where(eq(schema.users.id, target.id));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, target.id));
    return { ok: true, data: { action, email: target.email } };
  }

  if (action === "disable") {
    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, target.id));
  } else if (action === "revoke") {
    // „Odbierz dostęp": konto przestaje być adminem i jest wyłączone. Rola wraca do `trenerka`
    // bez `trainerId`, co żadna bramka nie przepuszcza (panel trenerki wymaga trainerId).
    // Wiersza NIE kasujemy — wpisy w dzienniku zmian wskazują na to konto (FK).
    await db
      .update(schema.users)
      .set({ role: "trenerka", trainerId: null, isActive: false })
      .where(eq(schema.users.id, target.id));
  }
  // Wyłączenie działa od razu: kasujemy sesje, żeby ciasteczko nie żyło do końca 8 h TTL.
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, target.id));
  return { ok: true, data: { action, email: target.email } };
}
