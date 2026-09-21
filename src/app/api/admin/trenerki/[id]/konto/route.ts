import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireAdmin, hashPassword, invalidateUserSessions } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

const bodySchema = z.object({
  /** Adres logowania. Wymagany tylko wtedy, gdy konto jeszcze nie istnieje. */
  email: z.string().trim().email().max(255).optional(),
});

/**
 * KONTO DOSTĘPOWE AKADEMII — utworzenie albo reset hasła, z hasłem pokazanym NA EKRANIE.
 *
 * Po co, skoro akademia zakłada konto sama na `/dla-akademii/rejestracja`:
 *  1. Trenerki dodane ręcznie w panelu (i wszystkie sprzed września 2026) nie mają konta wcale —
 *     `POST /api/admin/trenerki` tworzy wyłącznie profil, nigdy użytkownika.
 *  2. „Zapomniałam hasła” nie ma dziś jak zadziałać: skrzynka `szkolenia@` nie jest skonfigurowana,
 *     więc link resetujący nie doleciałby do nikogo. Hasło dyktuje się przez telefon — dlatego
 *     zwracamy je w odpowiedzi JEDEN RAZ i nigdzie nie zapisujemy w postaci jawnej.
 *
 * Bezpieczeństwo: hasło jest losowe (24 znaki), konto dostaje `mustChangePassword: true`
 * (serwerowy guard `requireTrainer` nie wypuści danych do czasu zmiany), a wszystkie
 * dotychczasowe sesje tego użytkownika lecą w kosz — reset hasła ma wyrzucić cudze urządzenie,
 * a nie działać obok niego.
 */
export async function POST(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const { id } = await params;
  const trainerId = Number(id);
  if (!Number.isInteger(trainerId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowy adres e-mail." }, { status: 400 });

  const db = await getDb();
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, trainerId)).limit(1);
  if (!trainer) return NextResponse.json({ error: "Nie znaleziono trenerki." }, { status: 404 });

  const password = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(password);

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.trainerId, trainerId)).limit(1);

  if (existing) {
    await db
      .update(schema.users)
      .set({ passwordHash, mustChangePassword: true, isActive: true })
      .where(eq(schema.users.id, existing.id));
    await invalidateUserSessions(existing.id);
    await logAudit({
      actor: actorLabel(user),
      action: "trenerka_haslo_zresetowane",
      entityType: "user",
      entityId: existing.id,
      details: { trainerId },
    });
    return NextResponse.json({ email: existing.email, password, created: false });
  }

  const email = (parsed.data.email || trainer.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Ta trenerka nie ma adresu e-mail w profilu — podaj adres logowania." },
      { status: 400 }
    );
  }

  const [emailTaken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (emailTaken) {
    return NextResponse.json(
      { error: "Konto z tym adresem już istnieje i należy do innej trenerki." },
      { status: 409 }
    );
  }

  const [created] = await db
    .insert(schema.users)
    .values({ email, passwordHash, role: "trenerka", trainerId, mustChangePassword: true, isActive: true })
    .returning();

  await logAudit({
    actor: actorLabel(user),
    action: "trenerka_konto_utworzone",
    entityType: "user",
    entityId: created.id,
    details: { trainerId, email },
  });

  return NextResponse.json({ email, password, created: true }, { status: 201 });
}
