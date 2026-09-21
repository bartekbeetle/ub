import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

/**
 * Hasło startowe kont trenerek.
 *
 * NIE jest już zaszyte w repo (audyt bezpieczeństwa 21.09.2026): wspólny, publicznie znany
 * string + wyliczalne loginy `<slug>@demo.…` dawały gotowy klucz do PII kursantek. Teraz:
 *   1) `TRAINER_SEED_PASSWORD` z env, jeśli ustawione (jedno, świadome hasło na batch), albo
 *   2) losowe 24-znakowe hasło wygenerowane per uruchomienie seeda (nie do odczytania z kodu).
 * W obu wariantach konto i tak dostaje `mustChangePassword: true`, a od 21.09 serwerowy guard
 * (`requireTrainer`) blokuje dostęp do danych do czasu ustawienia własnego hasła — więc nawet
 * znajomość hasła startowego nie daje wglądu w leady. Hasło startowe służy wyłącznie do
 * pierwszego logowania i natychmiastowej zmiany.
 */
const TRAINER_PASSWORD =
  process.env.TRAINER_SEED_PASSWORD?.trim() || randomBytes(18).toString("base64url");

function slugToDemoEmail(slug: string): string {
  return `${slug}@demo.uniwersytetbeauty.pl`;
}

/**
 * Idempotentnie tworzy konta logowania (users.role=trenerka) dla wszystkich trenerek.
 * - email = trainer.email jeśli istnieje, inaczej <slug>@demo.uniwersytetbeauty.pl
 * - hasło startowe: Trenerka!2026 (bcrypt 12), mustChangePassword=true
 * - upsert po emailu: jeśli konto już istnieje, pomija (nie duplikuje).
 * Zwraca listę { email, trainerName, created }.
 */
export async function seedTrainerUsers(
  db: {
    select: (...a: unknown[]) => any;
    insert: (...a: unknown[]) => any;
  },
  schema: typeof import("../src/db/schema"),
): Promise<{ email: string; trainerName: string; created: boolean }[]> {
  const { eq } = await import("drizzle-orm");
  const passwordHash = await bcrypt.hash(TRAINER_PASSWORD, 12);
  const trainers = await db.select().from(schema.trainers);
  const results: { email: string; trainerName: string; created: boolean }[] = [];

  for (const t of trainers) {
    const email = (t.email && t.email.trim() ? t.email : slugToDemoEmail(t.slug)).toLowerCase();
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existing.length > 0) {
      results.push({ email, trainerName: t.name, created: false });
      continue;
    }
    await db.insert(schema.users).values({
      email,
      passwordHash,
      role: "trenerka",
      trainerId: t.id,
      mustChangePassword: true,
      isActive: true,
    });
    results.push({ email, trainerName: t.name, created: true });
  }
  return results;
}

export { TRAINER_PASSWORD };
