import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { formatPln, formatDateTime } from "@/lib/utils";
import { BILLING_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const BILLING_COLORS: Record<string, string> = {
  do_zafakturowania: "bg-amber-100 text-amber-800",
  zafakturowane: "bg-blue-100 text-blue-800",
  oplacone: "bg-emerald-100 text-emerald-800",
};

export default async function PanelRozliczeniaPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "trenerka" || !user.trainerId) redirect("/panel/login");

  const db = await getDb();
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, user.trainerId)).limit(1);

  // TWARDA IZOLACJA: tylko przydziały tej trenerki
  const rows = await db
    .select({ assignment: schema.leadAssignments, lead: schema.leads })
    .from(schema.leadAssignments)
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .where(eq(schema.leadAssignments.trainerId, user.trainerId))
    .orderBy(desc(schema.leadAssignments.createdAt));

  const billable = rows.filter((r) => r.assignment.amount > 0);
  const totalDue = billable.reduce((s, r) => s + r.assignment.amount, 0);
  const paid = billable.filter((r) => r.assignment.billingStatus === "oplacone").reduce((s, r) => s + r.assignment.amount, 0);
  const outstanding = totalDue - paid;

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Rozliczenia</h1>
      <p className="mt-2 text-sm text-muted">
        Model rozliczenia: <strong className="text-ink-soft">{trainer?.billingModel === "per_lead" ? "opłata za lead" : "opłata za zapisaną kursantkę"}</strong>
        {" · "}stawka <strong className="text-ink-soft">{formatPln(trainer?.rate ?? 0)}</strong>. Status płatności ustala administrator.
      </p>

      {/* PODSUMOWANIE */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Naliczone łącznie</p>
          <p className="mt-1 font-serif text-2xl font-bold text-ink-soft">{formatPln(totalDue)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Opłacone</p>
          <p className="mt-1 font-serif text-2xl font-bold text-money-dark">{formatPln(paid)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Pozostało do zapłaty</p>
          <p className="mt-1 font-serif text-2xl font-bold text-ink-soft">{formatPln(outstanding)}</p>
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Kandydatka</th>
              <th className="px-4 py-3 font-semibold">Status leada</th>
              <th className="px-4 py-3 font-semibold">Kwota</th>
              <th className="px-4 py-3 font-semibold">Płatność</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ assignment, lead }) => (
              <tr key={assignment.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(assignment.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-ink-soft">{lead.anonymizedAt ? "—" : lead.name}</td>
                <td className="px-4 py-3">{assignment.status}</td>
                <td className="px-4 py-3 font-semibold text-money-dark">{formatPln(assignment.amount)}</td>
                <td className="px-4 py-3">
                  {assignment.amount > 0 ? (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${BILLING_COLORS[assignment.billingStatus] ?? "bg-gray-100 text-gray-700"}`}>
                      {BILLING_STATUS_LABELS[assignment.billingStatus]}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Brak rozliczeń — pojawią się po przydzieleniu i obsłudze pierwszych leadów.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
