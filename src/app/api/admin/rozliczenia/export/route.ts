import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { toCsv, formatDateTime } from "@/lib/utils";
import { BILLING_STATUS_LABELS } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "Brak autoryzacji." }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select({ assignment: schema.leadAssignments, trainer: schema.trainers, lead: schema.leads })
    .from(schema.leadAssignments)
    .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .orderBy(desc(schema.leadAssignments.createdAt));

  const csv = toCsv([
    ["ID przydziału", "Data", "Trenerka", "Model rozliczenia", "Lead ID", "Status przydziału", "Kwota (PLN)", "Status płatności"],
    ...rows.map(({ assignment, trainer }) => [
      assignment.id,
      formatDateTime(assignment.createdAt),
      trainer.name,
      trainer.billingModel === "per_lead" ? "za lead" : "za zapis",
      assignment.leadId,
      assignment.status,
      assignment.amount,
      BILLING_STATUS_LABELS[assignment.billingStatus] ?? assignment.billingStatus,
    ]),
  ]);

  await logAudit({ actor: actorLabel(user), action: "eksport_csv", entityType: "rozliczenia", details: { count: rows.length } });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rozliczenia-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
