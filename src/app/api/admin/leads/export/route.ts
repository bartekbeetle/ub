import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { toCsv, formatDateTime } from "@/lib/utils";
import { voivodeshipName, LEAD_STATUS_LABELS, SOURCE_LABELS } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: "Brak autoryzacji." }, { status: 401 });

  const db = await getDb();
  const leads = await db
    .select({ lead: schema.leads, course: schema.courses })
    .from(schema.leads)
    .leftJoin(schema.courses, eq(schema.leads.courseId, schema.courses.id))
    .orderBy(desc(schema.leads.createdAt));

  const rows: (string | number | null)[][] = [
    ["ID", "Data", "Imię i nazwisko", "Telefon", "Email", "Województwo", "Kategoria", "Status zawodowy", "Status", "Źródło", "Kurs", "UTM source", "UTM medium", "UTM campaign", "Notatki"],
    ...leads.map(({ lead, course }) => [
      lead.id,
      formatDateTime(lead.createdAt),
      lead.name,
      lead.phone,
      lead.email,
      voivodeshipName(lead.voivodeship),
      lead.category,
      lead.employmentStatus,
      LEAD_STATUS_LABELS[lead.status] ?? lead.status,
      SOURCE_LABELS[lead.source] ?? lead.source,
      course?.title ?? "",
      lead.utmSource,
      lead.utmMedium,
      lead.utmCampaign,
      lead.notes,
    ]),
  ];

  await logAudit({ actor: actorLabel(user), action: "eksport_csv", entityType: "leads", details: { count: leads.length } });

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leady-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
