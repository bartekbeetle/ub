import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";

/**
 * Bramka dla STRON CRM trenerki — pierwsza linia każdej strony, PRZED jakimkolwiek zapytaniem
 * o dane kursantek. Layout i strona renderują się równolegle, więc samo przekierowanie
 * w layoucie nie powstrzymałoby strony przed pobraniem danych (i wrzuceniem ich do `__next_f`).
 * Wszystkie trzy bramki to PRZEKIEROWANIA, nigdy podmiana widoku:
 *  - brak sesji trenerki → logowanie,
 *  - hasło startowe do zmiany → strona zmiany hasła,
 *  - konto przed aktywacją (`trainers.isActive = false`) → ekran startowy.
 */
export async function requireTrainerPage(): Promise<{ user: User; trainerId: number; trainerName: string }> {
  const user = await getSessionUser();
  if (!user || user.role !== "trenerka" || !user.trainerId) redirect("/panel/login");
  if (user.mustChangePassword) redirect("/panel/haslo");
  const db = await getDb();
  const [t] = await db
    .select({ isActive: schema.trainers.isActive, name: schema.trainers.name })
    .from(schema.trainers)
    .where(eq(schema.trainers.id, user.trainerId))
    .limit(1);
  if (!t?.isActive) redirect("/panel/start");
  return { user, trainerId: user.trainerId, trainerName: t.name };
}
