import Link from "next/link";
import { and, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { RevealContact } from "@/components/admin/RevealContact";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { formatDateTime, maskEmail, maskPhone } from "@/lib/utils";
import { CATEGORIES, LEAD_STATUSES, SOURCE_LABELS, VOIVODESHIPS, voivodeshipName, LEAD_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LeadyPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (LEAD_STATUSES as readonly string[]).includes(sp.status) ? sp.status : "";
  const kategoria = typeof sp.kategoria === "string" && (CATEGORIES as readonly string[]).includes(sp.kategoria) ? sp.kategoria : "";
  const woj = typeof sp.wojewodztwo === "string" ? sp.wojewodztwo : "";
  const trenerka = typeof sp.trenerka === "string" ? Number(sp.trenerka) : NaN;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const from = typeof sp.od === "string" ? sp.od : "";
  const to = typeof sp.do === "string" ? sp.do : "";

  const db = await getDb();
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(schema.leads.status, status as (typeof LEAD_STATUSES)[number]));
  if (kategoria) conditions.push(eq(schema.leads.category, kategoria));
  if (woj) conditions.push(eq(schema.leads.voivodeship, woj));
  if (q) conditions.push(or(ilike(schema.leads.name, `%${q}%`), ilike(schema.leads.email, `%${q}%`), ilike(schema.leads.phone, `%${q}%`))!);
  if (from) conditions.push(gte(schema.leads.createdAt, new Date(from)));
  if (to) conditions.push(lte(schema.leads.createdAt, new Date(to + "T23:59:59")));
  if (Number.isInteger(trenerka)) {
    const assigned = await db
      .select({ leadId: schema.leadAssignments.leadId })
      .from(schema.leadAssignments)
      .where(eq(schema.leadAssignments.trainerId, trenerka));
    conditions.push(inArray(schema.leads.id, assigned.length ? assigned.map((a) => a.leadId) : [-1]));
  }

  const [leads, allTrainers, assignments] = await Promise.all([
    db.select().from(schema.leads).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(schema.leads.createdAt)).limit(300),
    db.select({ id: schema.trainers.id, name: schema.trainers.name }).from(schema.trainers),
    db
      .select({ leadId: schema.leadAssignments.leadId, trainerId: schema.leadAssignments.trainerId })
      .from(schema.leadAssignments),
  ]);

  const trainerName = new Map(allTrainers.map((t) => [t.id, t.name]));
  const assignedBy = new Map<number, string[]>();
  for (const a of assignments) {
    const list = assignedBy.get(a.leadId) ?? [];
    list.push(trainerName.get(a.trainerId) ?? `#${a.trainerId}`);
    assignedBy.set(a.leadId, list);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">Leady <span className="text-base font-normal text-muted">({leads.length})</span></h1>
        <a href="/api/admin/leads/export" className="btn-outline !px-4 !py-2 !text-sm">Eksport CSV</a>
      </div>

      {/* FILTRY */}
      <form method="GET" className="card mt-5 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-7">
        <input type="search" name="q" defaultValue={q} placeholder="Szukaj (imię/email/tel)" className="input !py-2 !text-sm" aria-label="Szukaj" />
        <select name="status" defaultValue={status} className="input !py-2 !text-sm" aria-label="Status">
          <option value="">Status: wszystkie</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
        </select>
        <select name="kategoria" defaultValue={kategoria} className="input !py-2 !text-sm" aria-label="Kategoria">
          <option value="">Kategoria: wszystkie</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="wojewodztwo" defaultValue={woj} className="input !py-2 !text-sm" aria-label="Województwo">
          <option value="">Woj.: wszystkie</option>
          {VOIVODESHIPS.map((v) => <option key={v.slug} value={v.slug}>{v.name}</option>)}
        </select>
        <select name="trenerka" defaultValue={Number.isInteger(trenerka) ? String(trenerka) : ""} className="input !py-2 !text-sm" aria-label="Trenerka">
          <option value="">Trenerka: wszystkie</option>
          {allTrainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" name="od" defaultValue={from} className="input !py-2 !text-sm" aria-label="Data od" />
        <div className="flex gap-2">
          <input type="date" name="do" defaultValue={to} className="input !py-2 !text-sm" aria-label="Data do" />
          <button type="submit" className="btn-primary !px-4 !py-2 !text-sm">OK</button>
        </div>
      </form>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Imię i nazwisko</th>
              <th className="px-4 py-3 font-semibold">Kontakt</th>
              <th className="px-4 py-3 font-semibold">Kategoria</th>
              <th className="px-4 py-3 font-semibold">Woj.</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Trenerki</th>
              <th className="px-4 py-3 font-semibold">Źródło</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((l) => (
              <tr key={l.id} className="align-top hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(l.createdAt)}</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/leady/${l.id}`} className="text-sand-700 hover:underline">{l.name}</Link>
                </td>
                <td className="px-4 py-3">
                  {l.anonymizedAt ? (
                    <span className="text-xs italic text-muted">zanonimizowano (RODO)</span>
                  ) : (
                    <div className="space-y-1">
                      <div><RevealContact masked={maskPhone(l.phone)} full={l.phone} /></div>
                      <div><RevealContact masked={maskEmail(l.email)} full={l.email} /></div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{l.category}</td>
                <td className="px-4 py-3">{voivodeshipName(l.voivodeship)}</td>
                <td className="px-4 py-3"><LeadStatusSelect leadId={l.id} current={l.status} /></td>
                <td className="px-4 py-3 text-xs">{(assignedBy.get(l.id) ?? []).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted">{SOURCE_LABELS[l.source]}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">Brak leadów dla wybranych filtrów.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
