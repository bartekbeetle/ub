import Link from "next/link";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ResearchJobActions } from "@/components/admin/ResearchJobActions";
import { formatDateTime } from "@/lib/utils";
import {
  RESEARCH_JOB_STATUSES,
  RESEARCH_JOB_STATUS_COLORS,
  RESEARCH_JOB_STATUS_LABELS,
  voivodeshipName,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function KolejkaResearchuPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "pending";
  const status = (RESEARCH_JOB_STATUSES as readonly string[]).includes(raw) ? raw : raw === "wszystkie" ? "" : "pending";

  const db = await getDb();
  const where: SQL | undefined = status
    ? eq(schema.researchJobs.status, status as (typeof RESEARCH_JOB_STATUSES)[number])
    : undefined;

  const [jobs, counts] = await Promise.all([
    db
      .select({ job: schema.researchJobs, lead: schema.leads })
      .from(schema.researchJobs)
      .leftJoin(schema.leads, eq(schema.researchJobs.leadId, schema.leads.id))
      .where(where)
      .orderBy(desc(schema.researchJobs.createdAt))
      .limit(300),
    db
      .select({ status: schema.researchJobs.status, c: sql<number>`count(*)::int` })
      .from(schema.researchJobs)
      .groupBy(schema.researchJobs.status),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status as string, c.c]));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">
            Kolejka researchu <span className="text-base font-normal text-muted">({jobs.length})</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Każdy nowy lead zakłada tu zadanie: znajdź akademię w tym województwie i kategorii. Kolejka
            niczego nie miele sama — przerabia ją człowiek albo agent w sesji, a znalezione podmioty lądują w CRM.
          </p>
        </div>
        <Link href="/admin/crm-trenerki" className="btn-outline !px-4 !py-2 !text-sm">← CRM trenerki</Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {[...RESEARCH_JOB_STATUSES, "wszystkie"].map((s) => {
          const active = s === "wszystkie" ? status === "" : status === s;
          return (
            <Link
              key={s}
              href={`/admin/crm-trenerki/kolejka?status=${s}`}
              aria-current={active ? "true" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                active ? "bg-sand-400 text-ink-soft" : "bg-white text-muted hover:bg-gray-100"
              }`}
            >
              {s === "wszystkie" ? "Wszystkie" : RESEARCH_JOB_STATUS_LABELS[s]}
              {s !== "wszystkie" && ` (${countByStatus.get(s) ?? 0})`}
            </Link>
          );
        })}
      </div>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Zgłoszone</th>
              <th className="px-4 py-3 font-semibold">Lead</th>
              <th className="px-4 py-3 font-semibold">Kategoria</th>
              <th className="px-4 py-3 font-semibold">Województwo</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Notatka</th>
              <th className="px-4 py-3 font-semibold">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {jobs.map(({ job, lead }) => (
              <tr key={job.id} className="align-top hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(job.createdAt)}</td>
                <td className="px-4 py-3">
                  {lead ? (
                    <Link href={`/admin/leady/${lead.id}`} className="font-medium text-sand-700 hover:underline">
                      #{lead.id} {lead.anonymizedAt ? "(zanonimizowany)" : lead.name}
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">{job.category}</td>
                <td className="px-4 py-3">{voivodeshipName(job.voivodeship)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${RESEARCH_JOB_STATUS_COLORS[job.status]}`}>
                    {RESEARCH_JOB_STATUS_LABELS[job.status]}
                  </span>
                  {job.completedAt && <p className="mt-1 text-xs text-muted">{formatDateTime(job.completedAt)}</p>}
                </td>
                <td className="max-w-[260px] px-4 py-3 text-xs text-muted">{job.resultNotes || "—"}</td>
                <td className="px-4 py-3"><ResearchJobActions jobId={job.id} status={job.status} /></td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  Nic w tym widoku. Kolejka zapełnia się sama, gdy wpada nowy lead.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
