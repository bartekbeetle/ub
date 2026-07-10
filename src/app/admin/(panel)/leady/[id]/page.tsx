import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { RevealContact } from "@/components/admin/RevealContact";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { AssignTrainer, UnassignButton } from "@/components/admin/AssignTrainer";
import { AssignmentStatusSelect } from "@/components/admin/AssignmentStatusSelect";
import { LeadNotes } from "@/components/admin/LeadNotes";
import { AnonymizeButton } from "@/components/admin/AnonymizeButton";
import { formatDateTime, maskEmail, maskPhone, formatPln } from "@/lib/utils";
import { voivodeshipName, SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) notFound();

  const db = await getDb();
  const [rows, assignments, audit, activeTrainers] = await Promise.all([
    db
      .select({ lead: schema.leads, course: schema.courses })
      .from(schema.leads)
      .leftJoin(schema.courses, eq(schema.leads.courseId, schema.courses.id))
      .where(eq(schema.leads.id, leadId))
      .limit(1),
    db
      .select({ assignment: schema.leadAssignments, trainer: schema.trainers })
      .from(schema.leadAssignments)
      .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
      .where(eq(schema.leadAssignments.leadId, leadId)),
    db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.entityType, "lead"), eq(schema.auditLog.entityId, leadId)))
      .orderBy(desc(schema.auditLog.createdAt)),
    db.select({ id: schema.trainers.id, name: schema.trainers.name, city: schema.trainers.city }).from(schema.trainers).where(eq(schema.trainers.isActive, true)),
  ]);
  const row = rows[0];
  if (!row) notFound();
  const { lead, course } = row;

  const assignedIds = new Set(assignments.map((a) => a.trainer.id));
  const options = activeTrainers.filter((t) => !assignedIds.has(t.id));

  return (
    <div className="max-w-5xl">
      <Link href="/admin/leady" className="text-sm font-semibold text-sand-700 hover:underline">← Wróć do listy</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">
          Lead #{lead.id}: {lead.name}
          <span className={`ml-3 inline-flex rounded-full px-3 py-1 align-middle text-xs font-bold ${LEAD_STATUS_COLORS[lead.status]}`}>
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <LeadStatusSelect leadId={lead.id} current={lead.status} />
          {!lead.anonymizedAt && <AnonymizeButton leadId={lead.id} />}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* DANE */}
        <div className="card p-6">
          <h2 className="font-serif text-lg font-semibold">Dane zgłoszenia</h2>
          <dl className="mt-4 grid grid-cols-[140px_1fr] gap-y-2.5 text-sm">
            <dt className="text-muted">Telefon</dt>
            <dd>{lead.anonymizedAt ? "—" : <RevealContact masked={maskPhone(lead.phone)} full={lead.phone} />}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{lead.anonymizedAt ? "—" : <RevealContact masked={maskEmail(lead.email)} full={lead.email} />}</dd>
            <dt className="text-muted">Województwo</dt>
            <dd>{voivodeshipName(lead.voivodeship)}</dd>
            <dt className="text-muted">Kategoria</dt>
            <dd>{lead.category}</dd>
            <dt className="text-muted">Status zawodowy</dt>
            <dd>{lead.employmentStatus}</dd>
            <dt className="text-muted">Preferowany termin</dt>
            <dd>{lead.preferredDate ?? "—"}</dd>
            <dt className="text-muted">Źródło</dt>
            <dd>{SOURCE_LABELS[lead.source]}{course ? <> — <Link className="text-sand-700 hover:underline" href={`/kurs/${course.slug}`}>{course.title}</Link></> : null}</dd>
            <dt className="text-muted">UTM</dt>
            <dd className="text-xs">{[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(" / ") || "—"}</dd>
            <dt className="text-muted">Zgoda RODO</dt>
            <dd>{formatDateTime(lead.rodoConsentAt)}</dd>
            <dt className="text-muted">Utworzony</dt>
            <dd>{formatDateTime(lead.createdAt)}</dd>
            {lead.rejectionReason && (
              <>
                <dt className="text-muted">Powód odrzucenia</dt>
                <dd className="text-red-700">{lead.rejectionReason}</dd>
              </>
            )}
          </dl>
          <h3 className="mt-6 font-serif text-base font-semibold">Notatki</h3>
          <div className="mt-2">
            <LeadNotes leadId={lead.id} initial={lead.notes ?? ""} />
          </div>
        </div>

        {/* PRZYDZIAŁY */}
        <div className="card p-6">
          <h2 className="font-serif text-lg font-semibold">Przydzielone trenerki ({assignments.length})</h2>
          <div className="mt-4 space-y-3">
            {assignments.map(({ assignment, trainer }) => (
              <div key={assignment.id} className="rounded-[10px] border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{trainer.name}</p>
                    <p className="text-xs text-muted">
                      {trainer.city ?? "—"} · {trainer.billingModel === "per_lead" ? "za lead" : "za zapis"} · stawka {formatPln(trainer.rate)}
                    </p>
                  </div>
                  <UnassignButton leadId={lead.id} trainerId={trainer.id} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <AssignmentStatusSelect assignmentId={assignment.id} current={assignment.status} />
                  <span className="text-muted">Naliczono: <strong className="text-money-dark">{formatPln(assignment.amount)}</strong></span>
                  <span className="text-muted">Przydzielono: {formatDateTime(assignment.createdAt)} ({assignment.assignedBy})</span>
                </div>
              </div>
            ))}
            {assignments.length === 0 && <p className="text-sm text-muted">Brak przydziałów — dopasuj trenerkę ręcznie poniżej.</p>}
          </div>
          <h3 className="mt-6 font-serif text-base font-semibold">Przydziel ręcznie</h3>
          <div className="mt-2">
            <AssignTrainer leadId={lead.id} options={options} />
          </div>
        </div>
      </div>

      {/* AUDIT LOG */}
      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Historia (audit log)</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {audit.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3 border-b border-gray-50 pb-2">
              <span className="whitespace-nowrap text-xs text-muted">{formatDateTimeSafe(a.createdAt)}</span>
              <span className="font-semibold">{a.action}</span>
              <span className="text-muted">{a.actor}</span>
              {a.details && Object.keys(a.details).length > 0 && (
                <code className="text-xs text-muted">{JSON.stringify(a.details)}</code>
              )}
            </li>
          ))}
          {audit.length === 0 && <li className="text-muted">Brak wpisów.</li>}
        </ul>
      </div>
    </div>
  );
}

function formatDateTimeSafe(d: Date | null) {
  return d ? formatDateTime(d) : "—";
}
