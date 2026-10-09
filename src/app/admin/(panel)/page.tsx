import Link from "next/link";
import { and, desc, eq, gte, ne, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { isSuperadminRole } from "@/lib/roles";
import { formatDateTime, formatPln } from "@/lib/utils";
import { liczLeady, naplywDzienny } from "@/lib/lead-metrics-core";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, voivodeshipName } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  // Przychód i rozliczenia widzi tylko superadmin — dla admina nie wykonujemy nawet zapytań.
  const showBilling = isSuperadminRole((await getSessionUser())?.role);
  const db = await getDb();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Liczby o leadach — wyłącznie z `lead-metrics-core`, żeby dashboard i lejek nie rozjeżdżały się znowu.
  const [
    m,
    [{ c: activeTrainers }],
    [{ s: revenueMonth }],
    [{ c: pendingBilling }],
    [{ c: prospectsActive }],
    recentLeads,
    chart,
  ] = await Promise.all([
    liczLeady(db),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.trainers).where(eq(schema.trainers.isActive, true)),
    showBilling
      ? db
          .select({ s: sql<number>`coalesce(sum(${schema.leadAssignments.amount}), 0)::int` })
          .from(schema.leadAssignments)
          .where(gte(schema.leadAssignments.createdAt, monthStart))
      : Promise.resolve([{ s: 0 }]),
    showBilling
      ? db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.leadAssignments)
          .where(and(eq(schema.leadAssignments.billingStatus, "do_zafakturowania"), ne(schema.leadAssignments.amount, 0)))
      : Promise.resolve([{ c: 0 }]),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.prospects)
      .where(notInArray(schema.prospects.status, ["odrzucony", "parking"])),
    db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(10),
    naplywDzienny(db, 30),
  ]);

  const maxCount = Math.max(1, ...chart.map((c) => c.count));

  const stats = [
    { label: "Leady dziś", value: String(m.dzis), color: "bg-blue-100 text-blue-700" },
    { label: "Leady w tym miesiącu", value: String(m.miesiac), color: "bg-sand-100 text-sand-700" },
    {
      label: "Leady razem",
      value: String(m.rekordy),
      hint: `${m.osoby} osób (bez duplikatów)`,
      color: "bg-sand-100 text-sand-700",
    },
    {
      label: "Bez trenerki",
      value: String(m.bezAdresata.osoby),
      hint: m.bezAdresata.rekordy !== m.bezAdresata.osoby ? `${m.bezAdresata.rekordy} rekordów` : undefined,
      color: "bg-red-100 text-red-700",
    },
    { label: "Konwersja osoba → zapis", value: `${m.konwersja}%`, color: "bg-purple-100 text-purple-700" },
    ...(showBilling
      ? [{ label: "Przychód w tym miesiącu", value: formatPln(revenueMonth), color: "bg-emerald-100 text-emerald-700" }]
      : []),
    { label: "Aktywne trenerki", value: String(activeTrainers), color: "bg-amber-100 text-amber-700" },
    ...(showBilling
      ? [{ label: "Oczekujące rozliczenia", value: String(pendingBilling), color: "bg-red-100 text-red-700" }]
      : []),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/crm-trenerki/nowy" className="btn-primary !px-4 !py-2 !text-sm">+ Dodaj prospekta</Link>
          <Link href="/admin/trenerki/nowa" className="btn-outline !px-4 !py-2 !text-sm">+ Dodaj trenerkę</Link>
          <Link href="/admin/blog/nowy" className="btn-outline !px-4 !py-2 !text-sm">+ Nowy post</Link>
          <Link href="/admin/szkolenia/nowe" className="btn-outline !px-4 !py-2 !text-sm">+ Dodaj szkolenie</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${s.color}`}>{s.label}</span>
            <p className="mt-3 font-serif text-3xl font-bold text-ink-soft">{s.value}</p>
            {"hint" in s && s.hint && <p className="mt-1 text-xs text-muted">{s.hint}</p>}
          </div>
        ))}
      </div>

      {/* CRM TRENEREK — zaległości po stronie B2B, czyli tam, skąd bierze się przychód.
          Kafel „Leady czekające na research" usunięty 22.09.2026 razem z całą kolejką:
          liczył, ile roboty researchowej zalega, a zalegają telefony, nie research. */}
      <div className="mt-4 grid gap-4">
        <Link href="/admin/crm-trenerki" className="card p-5">
          <span className="inline-flex rounded-lg bg-sand-100 px-2.5 py-1 text-xs font-bold text-sand-700">
            Prospekty w pipeline
          </span>
          <p className="mt-3 font-serif text-3xl font-bold text-ink-soft">{prospectsActive}</p>
          <p className="mt-1 text-xs text-muted">Akademie i trenerki w lejku B2B (bez odrzuconych i parkingu) →</p>
        </Link>
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
          <Link href="/admin/kursantki" className="text-sm font-semibold text-sand-700 hover:text-ink-soft">
            Zobacz wszystkie →
          </Link>
        </div>
        {/* Tabela przewija się w swoim kontenerze — bez tego na telefonie sideways
            przewijała się CAŁA strona i treść uciekała poza ekran. */}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
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
                  <Link href={`/admin/kursantki/${l.id}`} className="text-sand-700 hover:underline">{l.name}</Link>
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
    </div>
  );
}
