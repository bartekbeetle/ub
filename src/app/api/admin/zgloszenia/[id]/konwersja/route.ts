import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { submissionConversionSchema, zodErrorMessage } from "@/lib/validators";
import { CONSENT_VERSION, SUBMISSION_TYPE_TO_LEAD_SOURCE } from "@/lib/constants";
import { actorLabel, logAudit } from "@/lib/audit";
import { distributeLead } from "@/lib/matching";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

/**
 * Zgłoszenie -> lead. Jedyna droga, którą kontakt bez kwalifikacji może wejść
 * do lejka sprzedażowego (a więc: do przydziału trenerce za 500 zł).
 *
 * Trzy rzeczy, które ten handler musi zagwarantować:
 * 1. zgoda na przekazanie danych trenerce jest odebrana ŚWIADOMIE i osobno (walidacja serwerowa),
 * 2. zgłoszenie zostaje w bazie jako ślad — nie kasujemy niczego, tylko oznaczamy,
 * 3. konwersja jest jednorazowa — drugie kliknięcie dostaje 409, nie drugiego leada.
 */
export async function POST(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const { id } = await params;
  const submissionId = Number(id);
  if (!Number.isInteger(submissionId)) {
    return NextResponse.json({ error: "Nieprawidłowy identyfikator zgłoszenia." }, { status: 400 });
  }

  const parsed = submissionConversionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }
  const data = parsed.data;

  const db = await getDb();
  const [submission] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.id, submissionId))
    .limit(1);

  if (!submission) {
    return NextResponse.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
  }
  if (submission.convertedToLeadId) {
    return NextResponse.json(
      {
        error: `To zgłoszenie zostało już przekonwertowane na leada #${submission.convertedToLeadId}.`,
        leadId: submission.convertedToLeadId,
      },
      { status: 409 }
    );
  }

  const consentAt = new Date();
  const source = SUBMISSION_TYPE_TO_LEAD_SOURCE[submission.type] ?? "landing";

  const [lead] = await db
    .insert(schema.leads)
    .values({
      name: data.name,
      phone: data.phone,
      email: submission.email,
      voivodeship: data.voivodeship,
      category: data.category,
      employmentStatus: data.employmentStatus,
      preferredDate: data.preferredDate || null,
      // Wiadomość ze zgłoszenia jedzie z leadem — to często jedyny kontekst,
      // jaki trenerka dostanie o tym, czego kursantka szuka.
      message: submission.message || null,
      notes: data.notes || null,
      source,
      status: "nowy",
      rodoConsentAt: consentAt,
      // Zgoda na telefon/SMS jest ODRĘBNA i nieobowiązkowa (art. 398 PKE). Gdy jej nie ma,
      // pole zostaje puste, a karta leada pokazuje „brak — nie dzwonić" — i tak ma być.
      contactConsentAt: data.contactConsent ? consentAt : null,
      consentVersion: CONSENT_VERSION,
    })
    .returning();

  // Zgłoszenie NIE znika — dostaje wskaźnik na leada i znacznik czasu.
  await db
    .update(schema.submissions)
    .set({ convertedToLeadId: lead.id, convertedAt: consentAt, isHandled: true })
    .where(eq(schema.submissions.id, submissionId));

  const actor = actorLabel(user);
  await logAudit({
    actor,
    action: "lead_utworzony_z_zgloszenia",
    entityType: "lead",
    entityId: lead.id,
    details: {
      submissionId,
      submissionType: submission.type,
      source,
      category: data.category,
      voivodeship: data.voivodeship,
      rodoConsentAt: consentAt.toISOString(),
      contactConsentAt: data.contactConsent ? consentAt.toISOString() : null,
      consentVersion: CONSENT_VERSION,
    },
  });
  await logAudit({
    actor,
    action: "zgloszenie_przekonwertowane",
    entityType: "submission",
    entityId: submissionId,
    details: { leadId: lead.id },
  });

  // Dalej lead idzie DOKŁADNIE tą samą drogą co ten z formularza kwalifikacyjnego:
  // kolejka researchu trenerek + automatyczna dystrybucja. Oba w try/catch — lead
  // ma istnieć nawet wtedy, gdy któryś z tych mechanizmów się wywróci.
  try {
    await db.insert(schema.researchJobs).values({
      leadId: lead.id,
      voivodeship: lead.voivodeship,
      category: lead.category,
      status: "pending",
    });
  } catch (err) {
    console.error("[konwersja] Nie udało się utworzyć zadania researchu:", err);
  }

  try {
    await distributeLead(lead);
  } catch (err) {
    console.error("[konwersja] Błąd dystrybucji:", err);
  }

  return NextResponse.json({ ok: true, leadId: lead.id });
}
