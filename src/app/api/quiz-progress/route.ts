import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { CONSENT_VERSION } from "@/lib/constants";

/**
 * Zapis POSTĘPU w quizie — kto zaczął i gdzie się zatrzymał.
 *
 * Wywoływane po każdym kroku. Dzięki temu widzimy, na którym pytaniu formularz się sypie,
 * i mamy kontakt do osób, które go nie dokończyły.
 *
 * 🔴 GRANICA, KTÓREJ TEN ENDPOINT PILNUJE:
 * zapis porzuconych odpowiedzi jest dopuszczalny, ale **mail marketingowy do osoby,
 * która quizu nie dokończyła, wymaga zaznaczonej zgody marketingowej** (art. 398 Prawa
 * komunikacji elektronicznej — kara do 3% przychodu albo 1 mln zł; UOKiK 24.07.2026 ukarał
 * spółkę na 308 728 zł, a prezesa osobiście na 100 000 zł).
 * Dlatego `marketingConsentAt` zapisujemy WYŁĄCZNIE, gdy checkbox był realnie zaznaczony,
 * i to ta kolumna — nie samo istnienie maila — jest jedynym dopuszczalnym filtrem wysyłki.
 *
 * Świadomie NIE zwracamy niczego poza `{ ok: true }` — endpoint jest publiczny, więc nie może
 * potwierdzać, czy dany e-mail już u nas był (to byłby wyciek informacji o bazie).
 */
const progressSchema = z.object({
  sessionKey: z.string().min(8).max(64),
  step: z.number().int().min(1).max(12),
  name: z.string().max(160).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  category: z.string().max(60).optional(),
  voivodeship: z.string().max(40).optional(),
  city: z.string().max(120).optional(),
  marketingConsent: z.boolean().optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(160).optional(),
  /** Ustawiane dopiero po realnym utworzeniu leada — zamyka sesję jako dokończoną. */
  completed: z.boolean().optional(),
  leadId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = progressSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const db = await getDb();
    const { quizSessions } = schema;

    const [istnieje] = await db
      .select({ id: quizSessions.id, maxStep: quizSessions.maxStepReached, zgoda: quizSessions.marketingConsentAt })
      .from(quizSessions)
      .where(eq(quizSessions.sessionKey, parsed.sessionKey))
      .limit(1);

    // Pola puste NIE nadpisują tego, co już zapisaliśmy — użytkowniczka może cofnąć się
    // do wcześniejszego kroku, a wtedy ładunek nie zawiera jeszcze późniejszych odpowiedzi.
    const dane = {
      name: parsed.name?.trim() || undefined,
      email: parsed.email?.trim().toLowerCase() || undefined,
      phone: parsed.phone?.trim() || undefined,
      category: parsed.category || undefined,
      voivodeship: parsed.voivodeship || undefined,
      city: parsed.city?.trim() || undefined,
      answers: parsed.answers ?? undefined,
      stepReached: parsed.step,
      utmSource: parsed.utmSource || undefined,
      utmMedium: parsed.utmMedium || undefined,
      utmCampaign: parsed.utmCampaign || undefined,
      updatedAt: new Date(),
      ...(parsed.completed ? { completed: true } : {}),
      ...(parsed.leadId ? { leadId: parsed.leadId } : {}),
    };

    // Zgodę zapisujemy tylko przy realnym zaznaczeniu i nigdy jej nie kasujemy tym endpointem —
    // wycofanie zgody to osobna, świadoma operacja, nie efekt uboczny cofnięcia się w quizie.
    const zgoda =
      parsed.marketingConsent === true && !istnieje?.zgoda
        ? { marketingConsentAt: new Date(), consentVersion: CONSENT_VERSION }
        : {};

    if (istnieje) {
      await db
        .update(quizSessions)
        .set({
          ...dane,
          ...zgoda,
          maxStepReached: Math.max(istnieje.maxStep, parsed.step),
        })
        .where(eq(quizSessions.id, istnieje.id));
    } else {
      await db.insert(quizSessions).values({
        sessionKey: parsed.sessionKey,
        ...dane,
        ...zgoda,
        maxStepReached: parsed.step,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Zapis postępu jest pomocniczy — NIGDY nie może zablokować wypełniania quizu.
    console.error("[quiz-progress]", e);
    return NextResponse.json({ ok: true });
  }
}
