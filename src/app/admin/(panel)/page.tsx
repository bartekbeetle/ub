import Link from "next/link";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { formatDateTime, formatPln } from "@/lib/utils";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, voivodeshipName } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const db = await getDb();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const days30 = new Date(Date.now() - 30 * 86400000);

  const [
    [{ c: leadsToday }],
    [{ c: leadsMonth }],
    [{ c: leadsTotal }],
    [{ c: signedTotal }],
    [{ c: activeTrainers }],
    [{ s: revenueMonth }],
    [{ c: pendingBilling }],
    recentLeads,
    dailyRaw,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(schema.leads).where(gte(schema.leads.createdAt, todayStart)),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.leads).where(gte(schema.leads.createdAt, monthStart)),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.leads),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.leads).where(eq(schema.leads.status, "zapisana")),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.trainers).where(eq(schema.trainers.isActive, true)),
    db
      .select({ s: sql<number>`coalesce(sum(${schema.leadAssignments.amount}), 0)::int` })
      .from(schema.leadAssignments)
      .where(gte(schema.leadAssignments.createdAt, monthStart)),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.leadAssignments)
      .where(and(eq(schema.leadAssignments.billingStatus, "do_zafakturowania"), ne(schema.leadAssignments.amount, 0))),
    db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(10),
    db
      .select({ day: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`, c: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(gte(schema.leads.createdAt, days30))
      .groupBy(sql`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`),
  ]);

  const conversion = leadsTotal > 0 ? Math.round((signedTotal / leadsTotal) * 100) : 0;

  // wykres 30 dni (czyste divy, bez biblioteki)
  const byDay = new Map(dailyRaw.map((d) => [d.day, d.c]));
  const chart: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    chart.push({ day: d, count: byDay.get(d) ?? 0 });
  }
  const maxCount = Math.max(1, ...chart.map((c) => c.count));

  const stats = [
    { label: "Leady dziś", value: String(leadsToday), color: "bg-blue-100 text-blue-700" },
    { label: "Leady w tym miesiącu", value: String(leadsMonth), color: "bg-sand-100 text-sand-700" },
    { label: "Konwersja lead → zapis", value: `${conversion}%`, color: "bg-purple-100 text-purple-700" },
    { label: "Przychód w tym miesiącu", value: formatPln(revenueMonth), color: "bg-emerald-100 text-emerald-700" },
    { label: "Aktywne trenerki", value: String(activeTrainers), color: "bg-amber-100 text-amber-700" },
    { label: "Oczekujące rozliczenia", value: String(pendingBilling), color: "bg-red-100 text-red-700" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/trenerki/nowa" className="btn-primary !px-4 !py-2 !text-sm">+ Dodaj trenerkę</Link>
          <Link href="/admin/blog/nowy" className="btn-outline !px-4 !py-2 !text-sm">+ Nowy post</Link>
          <Link href="/admin/szkolenia/nowe" className="btn-outline !px-4 !py-2 !text-sm">+ Dodaj szkolenie</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${s.color}`}>{s.label}</span>
            <p className="mt-3 font-serif text-3xl font-bold text-ink-soft">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Leady — ostatnie 30 dni</h2>
        <div className="mt-4 flex h-36 items-end gap-[3px]" role="img" aria-label={`Wykres leadów z 30 dni, maksymalnie ${maxCount} dziennie`}>
          {chart.map((c) => (
            <div key={c.day} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-sand-400 transition-colors group-hover:bg-sand-600"
                style={{ height: `${Math.max(3, (c.count / maxCount) * 130)}px` }}
              />
              <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-navy px-2 py-0.5 text-xs text-white group-hover:block">
                {c.day}: {c.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-serif text-lg font-semibold">Ostatnie leady</h2>
          <Link href="/admin/leady" className="text-sm font-semibold text-sand-700 hover:text-sand-500">
            Zobacz wszystkie →
          </Link>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-6 py-3 font-semibold">Data</th>
              <th className="px-6 py-3 font-semibold">Imię</th>
              <th className="px-6 py-3 font-semibold">Kategoria</th>
              <th className="px-6 py-3 font-semibold">Województwo</th>
              <th className="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recentLeads.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-muted">{formatDateTime(l.createdAt)}</td>
                <td className="px-6 py-3 font-medium">
                  <Link href={`/admin/leady/${l.id}`} className="text-sand-700 hover:underline">{l.name}</Link>
                </td>
                <td className="px-6 py-3">{l.category}</td>
                <td className="px-6 py-3">{voivodeshipName(l.voivodeship)}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${LEAD_STATUS_COLORS[l.status]}`}>
                    {LEAD_STATUS_LABELS[l.status]}
                  </span>
                </td>
              </tr>
            ))}
            {recentLeads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted">Brak leadów — jeszcze.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
