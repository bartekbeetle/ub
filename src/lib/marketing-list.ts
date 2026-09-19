import "server-only";
import { randomBytes } from "crypto";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Lista mailingowa i wypisania.
 *
 * Zasada, na której to stoi: **wypisanie należy do człowieka, nie do rekordu.**
 * Wszystko jest kluczowane znormalizowanym adresem e-mail, bo ta sama kobieta bywa
 * w bazie kilka razy (duplikaty leadów, porzucone sesje quizu).
 */

/** Ten sam adres zapisany różnie („Ania@X.PL" / „ania@x.pl ") musi trafić w ten sam wiersz. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Zwraca token do linku „nie chcę więcej propozycji szkoleń", tworząc wiersz przy
 * pierwszym mailingu do tego adresu. Idempotentne — kolejne wywołania oddają ten sam token,
 * żeby stare maile nie przestawały działać.
 */
export async function getOrCreateUnsubscribeToken(email: string): Promise<string> {
  const db = await getDb();
  const normalized = normalizeEmail(email);

  const existing = await db
    .select({ token: schema.marketingSuppression.token })
    .from(schema.marketingSuppression)
    .where(eq(schema.marketingSuppression.email, normalized))
    .limit(1);
  if (existing[0]) return existing[0].token;

  const token = randomBytes(32).toString("hex");
  const [row] = await db
    .insert(schema.marketingSuppression)
    .values({ email: normalized, token })
    .onConflictDoNothing({ target: schema.marketingSuppression.email })
    .returning();

  // Wyścig: ktoś wstawił ten sam adres między SELECT a INSERT — dociągamy jego token.
  if (row) return row.token;
  const after = await db
    .select({ token: schema.marketingSuppression.token })
    .from(schema.marketingSuppression)
    .where(eq(schema.marketingSuppression.email, normalized))
    .limit(1);
  return after[0]?.token ?? token;
}

/**
 * Czy ten adres wypisał się z mailingu. **Sprawdzaj przed KAŻDĄ wysyłką marketingową.**
 * Maile transakcyjne (potwierdzenie zgłoszenia, potwierdzenie zapisu) tego nie dotyczą —
 * to obsługa sprawy, o którą kursantka sama poprosiła, nie marketing.
 */
export async function isUnsubscribed(email: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.marketingSuppression.id })
    .from(schema.marketingSuppression)
    .where(
      and(
        eq(schema.marketingSuppression.email, normalizeEmail(email)),
        isNotNull(schema.marketingSuppression.optOutAt)
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Odfiltrowuje wypisanych z listy adresów — do użycia przy wysyłce partiami. */
export async function filterSubscribed(emails: string[]): Promise<string[]> {
  const results = await Promise.all(
    emails.map(async (e) => ((await isUnsubscribed(e)) ? null : e))
  );
  return results.filter((e): e is string => e !== null);
}

/**
 * Wypisanie z mailingu po tokenie z linku.
 * Zwraca `null`, gdy token nie istnieje (link przepisany ręcznie albo podrobiony).
 * Powtórne wypisanie nie jest błędem — oddajemy ten sam wynik, bo z punktu widzenia
 * kursantki stan jest ten sam.
 */
export async function unsubscribeByToken(
  token: string,
  source = "link"
): Promise<{ email: string; alreadyOptedOut: boolean } | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.marketingSuppression)
    .where(eq(schema.marketingSuppression.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (row.optOutAt) return { email: row.email, alreadyOptedOut: true };

  await db
    .update(schema.marketingSuppression)
    .set({ optOutAt: new Date(), optOutSource: source })
    .where(eq(schema.marketingSuppression.id, row.id));

  return { email: row.email, alreadyOptedOut: false };
}

/** Podgląd stanu adresu — na stronę wypisania, przed kliknięciem przycisku. */
export async function getSuppressionByToken(token: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.marketingSuppression)
    .where(eq(schema.marketingSuppression.token, token))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Adresy dopuszczone do eksportu marketingowego (np. grupy odbiorców w Meta).
 *
 * 🔴 Dopóki nie ma opinii prawnej, wypisani są pomijani **całkowicie** — także jako materiał
 * do grup podobnych odbiorców. Przełącznik `lookalikeAllowed` istnieje, ale domyślnie jest
 * wyłączony i nie wolno go włączać hurtem bez tej opinii. Patrz komentarz przy tabeli.
 */
export async function emailsForMarketingExport(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ email: schema.marketingSuppression.email })
    .from(schema.marketingSuppression)
    .where(isNull(schema.marketingSuppression.optOutAt));
  return rows.map((r) => r.email);
}
