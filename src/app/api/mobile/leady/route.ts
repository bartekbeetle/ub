import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireTrainerMobile, ONBOARDING_GATE_MESSAGE } from "@/lib/mobile-auth";
import { voivodeshipName } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * Lista przydzielonych kursantek — odpowiednik strony `/panel/leady`.
 * Zapytanie i bramki odwzorowane 1:1 z tamtej strony, żeby telefon pokazywał
 * te same liczby co przeglądarka.
 */
export async function GET(req: Request) {
  const auth = await requireTrainerMobile(req);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  // BRAMKA ONBOARDINGU — konto przed aktywacją nie ogląda danych kursantek.
  // Sprawdzane serwerowo, przed zapytaniem o przydziały: „pusto, bo nic nie przydzielono"
  // to poprawność przez przypadek, a nie zabezpieczenie.
  if (!auth.trainer.isActive) {
    return NextResponse.json({ error: ONBOARDING_GATE_MESSAGE }, { status: 403 });
  }

  const db = await getDb();
  // TWARDA IZOLACJA: tylko przydziały tej trenerki
  const rows = await db
    .select({ assignment: schema.leadAssignments, lead: schema.leads })
    .from(schema.leadAssignments)
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .where(eq(schema.leadAssignments.trainerId, auth.trainer.id))
    .orderBy(desc(schema.leadAssignments.createdAt));

  return NextResponse.json({
    trainer: { name: auth.trainer.name, billingModel: auth.trainer.billingModel, rate: auth.trainer.rate },
    leady: rows.map(({ assignment, lead }) => {
      const anonymized = Boolean(lead.anonymizedAt);
      return {
        id: assignment.id,
        status: assignment.status,
        rejectionReason: assignment.rejectionReason,
        createdAt: assignment.createdAt.toISOString(),
        amount: assignment.amount,
        billingStatus: assignment.billingStatus,
        anonymized,
        name: anonymized ? null : lead.name,
        // Kontakt wydajemy tylko dla nieanonimizowanego rekordu — dokładnie tyle,
        // ile pokazuje panel webowy. Aplikacja nie poszerza dostępu do danych.
        phone: anonymized ? null : lead.phone,
        email: anonymized ? null : lead.email,
        // Zgłoszenia sprzed rozdzielenia zgód nie mają odrębnej zgody na telefon
        // (art. 398 Prawa komunikacji elektronicznej). Aplikacja MUSI to pokazać
        // i zablokować przycisk dzwonienia — to odpowiedzialność trenerki, nie tylko nasza.
        phoneConsent: Boolean(lead.contactConsentAt),
        category: lead.category,
        voivodeship: voivodeshipName(lead.voivodeship),
        employmentStatus: lead.employmentStatus,
        preferredDate: lead.preferredDate,
        message: anonymized ? null : lead.message,
      };
    }),
  });
}
