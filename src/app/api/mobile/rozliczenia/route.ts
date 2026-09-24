import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireTrainerMobile, ONBOARDING_GATE_MESSAGE } from "@/lib/mobile-auth";

export const runtime = "nodejs";

/**
 * Rozliczenia — odpowiednik `/panel/rozliczenia`. Sumy liczone tą samą metodą,
 * żeby kwota w telefonie zgadzała się co do złotówki z kwotą w przeglądarce.
 */
export async function GET(req: Request) {
  const auth = await requireTrainerMobile(req);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  // Rozliczenia pokazują nazwiska kursantek i kwoty — konto przed umową nie ma tu czego oglądać.
  if (!auth.trainer.isActive) {
    return NextResponse.json({ error: ONBOARDING_GATE_MESSAGE }, { status: 403 });
  }

  const db = await getDb();
  const rows = await db
    .select({ assignment: schema.leadAssignments, lead: schema.leads })
    .from(schema.leadAssignments)
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .where(eq(schema.leadAssignments.trainerId, auth.trainer.id))
    .orderBy(desc(schema.leadAssignments.createdAt));

  const billable = rows.filter((r) => r.assignment.amount > 0);
  const totalDue = billable.reduce((s, r) => s + r.assignment.amount, 0);
  const paid = billable
    .filter((r) => r.assignment.billingStatus === "oplacone")
    .reduce((s, r) => s + r.assignment.amount, 0);

  return NextResponse.json({
    billingModel: auth.trainer.billingModel,
    rate: auth.trainer.rate,
    totalDue,
    paid,
    outstanding: totalDue - paid,
    pozycje: rows.map(({ assignment, lead }) => ({
      id: assignment.id,
      createdAt: assignment.createdAt.toISOString(),
      name: lead.anonymizedAt ? null : lead.name,
      status: assignment.status,
      amount: assignment.amount,
      billingStatus: assignment.billingStatus,
    })),
  });
}
