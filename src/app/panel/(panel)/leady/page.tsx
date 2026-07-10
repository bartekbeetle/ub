import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { PanelAssignmentStatus } from "@/components/panel/PanelAssignmentStatus";
import { formatDateTime } from "@/lib/utils";
import { voivodeshipName } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ASSIGN_STATUS_COLORS: Record<string, string> = {
  przydzielony: "bg-amber-100 text-amber-800",
  skontaktowany: "bg-purple-100 text-purple-800",
  zapisana: "bg-emerald-100 text-emerald-800",
  odrzucony: "bg-red-100 text-red-700",
};

export default async function PanelLeadyPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "trenerka" || !user.trainerId) redirect("/panel/login");

  const db = await getDb();
  // TWARDA IZOLACJA: tylko przydziały tej trenerki
  const rows = await db
    .select({ assignment: schema.leadAssignments, lead: schema.leads })
    .from(schema.leadAssignments)
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .where(eq(schema.leadAssignments.trainerId, user.trainerId))
    .orderBy(desc(schema.leadAssignments.createdAt));

  const active = rows.filter((r) => r.assignment.status !== "odrzucony");
  const signed = rows.filter((r) => r.assignment.status === "zapisana").length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">
          Moje leady <span className="text-base font-normal text-muted">({rows.length})</span>
        </h1>
        <div className="flex gap-6 text-sm">
          <span className="text-muted">Aktywne: <strong className="text-ink-soft">{active.length}</strong></span>
          <span className="text-muted">Zapisane: <strong className="text-money-dark">{signed}</strong></span>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted">
        To są kandydatki przydzielone do Ciebie. Skontaktuj się z każdą w ciągu 24h, a po zapisaniu na szkolenie zmień status na <strong>„Zapisana”</strong>.
      </p>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Imię i nazwisko</th>
              <th className="px-4 py-3 font-semibold">Kontakt</th>
              <th className="px-4 py-3 font-semibold">Kategoria</th>
              <th className="px-4 py-3 font-semibold">Woj.</th>
              <th className="px-4 py-3 font-semibold">Status zaw.</th>
              <th className="px-4 py-3 font-semibold">Termin / wiadomość</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ assignment, lead }) => (
              <tr key={assignment.id} className="align-top hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(assignment.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-ink-soft">{lead.name}</td>
                <td className="px-4 py-3">
                  {lead.anonymizedAt ? (
                    <span className="text-xs italic text-muted">zanonimizowano (RODO)</span>
                  ) : (
                    <div className="space-y-1">
                      <div><a href={`tel:${lead.phone}`} className="font-medium text-sand-700 hover:underline">{lead.phone}</a></div>
                      <div><a href={`mailto:${lead.email}`} className="text-sand-700 hover:underline">{lead.email}</a></div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{lead.category}</td>
                <td className="px-4 py-3">{voivodeshipName(lead.voivodeship)}</td>
                <td className="px-4 py-3">{lead.employmentStatus}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {lead.preferredDate && <div>Termin: {lead.preferredDate}</div>}
                  {lead.message && <div className="max-w-[220px] whitespace-pre-wrap">{lead.message}</div>}
                  {!lead.preferredDate && !lead.message && "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1.5">
                    <PanelAssignmentStatus assignmentId={assignment.id} current={assignment.status} />
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ASSIGN_STATUS_COLORS[assignment.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {assignment.status}
                    </span>
                    {assignment.status === "odrzucony" && assignment.rejectionReason && (
                      <p className="max-w-[180px] text-[11px] text-red-700">Powód: {assignment.rejectionReason}</p>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">Nie masz jeszcze przydzielonych leadów. Damy znać mailowo, gdy pojawi się kandydatka.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
