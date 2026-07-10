import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { BillingStatusSelect } from "@/components/admin/AssignmentStatusSelect";
import { formatPln, formatDateTime } from "@/lib/utils";
import { BILLING_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function RozliczeniaPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const now = new Date();
  const monthParam = typeof sp.miesiac === "string" && /^\d{4}-\d{2}$/.test(sp.miesiac)
    ? sp.miesiac
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = monthParam.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);

  const db = await getDb();
  const rows = await db
    .select({ assignment: schema.leadAssignments, trainer: schema.trainers, lead: schema.leads })
    .from(schema.leadAssignments)
    .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .where(and(gte(schema.leadAssignments.createdAt, monthStart), lt(schema.leadAssignments.createdAt, monthEnd)))
    .orderBy(desc(schema.leadAssignments.createdAt));

  // agregacja per trenerka
  type Agg = {
    trainer: typeof schema.trainers.$inferSelect;
    leadsCount: number;
    signedCount: number;
    amountDue: number;
    items: typeof rows;
  };
  const byTrainer = new Map<number, Agg>();
  for (const row of rows) {
    const agg = byTrainer.get(row.trainer.id) ?? { trainer: row.trainer, leadsCount: 0, signedCount: 0, amountDue: 0, items: [] as typeof rows };
    agg.leadsCount++;
    if (row.assignment.status === "zapisana") agg.signedCount++;
    agg.amountDue += row.assignment.amount;
    agg.items.push(row);
    byTrainer.set(row.trainer.id, agg);
  }
  const aggregates = [...byTrainer.values()].sort((a, b) => b.amountDue - a.amountDue);
  const total = aggregates.reduce((s, a) => s + a.amountDue, 0);

  // opcje miesięcy (ostatnie 12)
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">Rozliczenia</h1>
        <div className="flex items-center gap-3">
          <form method="GET">
            <select name="miesiac" defaultValue={monthParam} className="input !py-2 !text-sm" aria-label="Miesiąc">
              {months.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
            </select>
            <button type="submit" className="btn-primary ml-2 !px-4 !py-2 !text-sm">Pokaż</button>
          </form>
          <a href="/api/admin/rozliczenia/export" className="btn-outline !px-4 !py-2 !text-sm">Eksport CSV</a>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Miesiąc <strong className="text-ink-soft">{monthParam}</strong> · do rozliczenia łącznie:{" "}
        <strong className="text-money-dark">{formatPln(total)}</strong>
      </p>

      <div className="mt-6 space-y-6">
        {aggregates.map((agg) => (
          <div key={agg.trainer.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div>
                <h2 className="font-serif text-lg font-semibold">{agg.trainer.name}</h2>
                <p className="text-xs text-muted">
                  Model: {agg.trainer.billingModel === "per_lead" ? "opłata za lead" : "opłata za zapis"} · stawka {formatPln(agg.trainer.rate)}
                </p>
              </div>
              <div className="flex gap-6 text-sm">
                <span>Leady: <strong>{agg.leadsCount}</strong></span>
                <span>Zapisane: <strong className="text-money-dark">{agg.signedCount}</strong></span>
                <span>Kwota: <strong className="text-money-dark">{formatPln(agg.amountDue)}</strong></span>
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-6 py-2.5 font-semibold">Data</th>
                  <th className="px-6 py-2.5 font-semibold">Lead</th>
                  <th className="px-6 py-2.5 font-semibold">Status przydziału</th>
                  <th className="px-6 py-2.5 font-semibold">Kwota</th>
                  <th className="px-6 py-2.5 font-semibold">Płatność</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agg.items.map(({ assignment, lead }) => (
                  <tr key={assignment.id}>
                    <td className="px-6 py-2.5 text-muted">{formatDateTime(assignment.createdAt)}</td>
                    <td className="px-6 py-2.5">
                      <a href={`/admin/leady/${lead.id}`} className="font-medium text-sand-700 hover:underline">#{lead.id} {lead.name}</a>
                    </td>
                    <td className="px-6 py-2.5">{assignment.status}</td>
                    <td className="px-6 py-2.5 font-semibold text-money-dark">{formatPln(assignment.amount)}</td>
                    <td className="px-6 py-2.5">
                      {assignment.amount > 0 ? (
                        <BillingStatusSelect assignmentId={assignment.id} current={assignment.billingStatus} />
                      ) : (
                        <span className="text-xs text-muted">{BILLING_STATUS_LABELS[assignment.billingStatus]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {aggregates.length === 0 && (
          <div className="card p-10 text-center text-muted">Brak przydziałów w miesiącu {monthParam}.</div>
        )}
      </div>
    </div>
  );
}
