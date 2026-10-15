import Link from "next/link";
import { KANAL_LABELS, kanalLeada } from "@/lib/lead-channel";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { adminMessageLog } from "@/lib/crm-core";
import { isSuperadminRole } from "@/lib/roles";
import { RevealContact } from "@/components/admin/RevealContact";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { AssignTrainer, UnassignButton } from "@/components/admin/AssignTrainer";
import { AssignmentStatusSelect } from "@/components/admin/AssignmentStatusSelect";
import { LeadNotes } from "@/components/admin/LeadNotes";
import { LeadExtraCategories } from "@/components/admin/LeadExtraCategories";
import { AnonymizeButton } from "@/components/admin/AnonymizeButton";
import { QuizAnswers } from "@/components/admin/QuizAnswers";
import { formatDateTime, maskEmail, maskPhone, formatPln } from "@/lib/utils";
import { voivodeshipName, SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/constants";
import { DrawerItem } from "@/components/ui/Drawer";

/**
 * Karta kursantki (leada). Jedna treść, dwa opakowania:
 * - `page`   — pełna podstrona `/admin/kursantki/[id]` (link z maila, nowa karta),
 * - `drawer` — panel wysuwany nad listą (`?panel=kursantka&id=`), jedna kolumna, kaskada wejścia.
 * Logika i zapytania są wspólne — zmieniamy tylko sposób pokazania.
 */
export async function LeadDetail({ leadId, variant = "page" }: { leadId: number; variant?: "page" | "drawer" }) {
  const drawer = variant === "drawer";
  if (!Number.isInteger(leadId)) return drawer ? <BrakLeada /> : notFound();
  // W panelu każdy blok wchodzi kaskadowo; na pełnej stronie zostaje zwykły układ.
  let n = 0;
  const Item = ({ className, children }: { className?: string; children: ReactNode }) =>
    drawer ? <DrawerItem i={n++} className={className}>{children}</DrawerItem> : <div className={className}>{children}</div>;

  const showBilling = isSuperadminRole((await getSessionUser())?.role);
  const db = await getDb();
  const [rows, assignments, audit, activeTrainers, zrodloweZgloszenia, korespondencja] = await Promise.all([
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
    // Lead mógł powstać z uzupełnienia zgłoszenia — wtedy ślad prowadzi w obie strony.
    db
      .select({ id: schema.submissions.id, type: schema.submissions.type, createdAt: schema.submissions.createdAt })
      .from(schema.submissions)
      .where(eq(schema.submissions.convertedToLeadId, leadId))
      .limit(1),
    // Dziennik wiadomości trenerek do tej kursantki (tylko odczyt, bez kwot i rozliczeń).
    adminMessageLog(db, leadId),
  ]);
  const row = rows[0];
  if (!row) return drawer ? <BrakLeada /> : notFound();
  const { lead, course } = row;
  const zgloszenie = zrodloweZgloszenia[0];

  const assignedIds = new Set(assignments.map((a) => a.trainer.id));
  // Do komponentu klienckiego idzie tylko to, czego potrzebuje; stawki nie wyciekają do payloadu RSC.
  const options = activeTrainers.filter((t) => !assignedIds.has(t.id)).map((t) => (showBilling ? t : { ...t, rate: 0 }));

  return (
    <div className={drawer ? "space-y-5" : "max-w-5xl"}>
      {!drawer && <Link href="/admin/kursantki" className="text-sm font-semibold text-sand-700 hover:underline">← Wróć do Kursantek</Link>}
      <Item className={drawer ? "space-y-3" : "mt-3 flex flex-wrap items-center justify-between gap-4"}>
        <h1 className={drawer ? "font-serif text-xl font-bold" : "font-serif text-2xl font-bold"}>
          Lead #{lead.id}: {lead.name}
          <span className={`ml-3 inline-flex rounded-full px-3 py-1 align-middle text-xs font-bold ${LEAD_STATUS_COLORS[lead.status]}`}>
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <LeadStatusSelect leadId={lead.id} current={lead.status} />
          {!lead.anonymizedAt && (
            <Link href={`/admin/skrzynka/nowa?lead=${lead.id}`} className="btn-outline !px-4 !py-2 !text-sm">
              Napisz maila
            </Link>
          )}
          {!lead.anonymizedAt && <AnonymizeButton leadId={lead.id} />}
        </div>
      </Item>

      <Wrap drawer={drawer} className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* DANE */}
        <Item className={drawer ? "card p-5" : "card p-6"}>
          <h2 className="font-serif text-lg font-semibold">Dane zgłoszenia</h2>
          <dl className="mt-4 grid grid-cols-[minmax(0,130px)_1fr] gap-x-3 gap-y-2.5 text-sm">
            <dt className="text-muted">Telefon</dt>
            <dd>{lead.anonymizedAt ? "—" : <RevealContact masked={maskPhone(lead.phone)} full={lead.phone} />}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{lead.anonymizedAt ? "—" : <RevealContact masked={maskEmail(lead.email)} full={lead.email} />}</dd>
            <dt className="text-muted">Województwo</dt>
            <dd>{voivodeshipName(lead.voivodeship)}</dd>
            <dt className="text-muted">Kategoria główna</dt>
            <dd>
              <span className="font-semibold">{lead.category}</span>
              <span className="block text-xs text-muted">pierwotny wybór w formularzu</span>
            </dd>
            <dt className="text-muted">Kategoria dodatkowa</dt>
            <dd>
              <LeadExtraCategories leadId={lead.id} main={lead.category} initial={lead.extraCategories} />
              <span className="mt-1 block text-xs text-muted">inne kursy, o które pytała — liczą się w „leadach od ręki” akademii</span>
            </dd>
            <dt className="text-muted">Status zawodowy</dt>
            <dd>{lead.employmentStatus}</dd>
            <dt className="text-muted">Preferowany termin</dt>
            <dd>{lead.preferredDate ?? "—"}</dd>
            {lead.message && (
              <>
                <dt className="text-muted">Wiadomość</dt>
                <dd><QuizAnswers message={lead.message} /></dd>
              </>
            )}
            <dt className="text-muted">Źródło</dt>
            <dd>{kanalLeada(lead) ? KANAL_LABELS[kanalLeada(lead)!] : SOURCE_LABELS[lead.source]}{course ? <> — <Link className="text-sand-700 hover:underline" href={`/kurs/${course.slug}`}>{course.title}</Link></> : null}</dd>
            <dt className="text-muted">UTM</dt>
            <dd className="text-xs">{[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(" / ") || "—"}</dd>
            {zgloszenie && (
              <>
                <dt className="text-muted">Powstał ze zgłoszenia</dt>
                <dd>
                  <Link href={`/admin/kursantki/zgloszenie/${zgloszenie.id}`} className="text-sand-700 hover:underline">
                    #{zgloszenie.id} ({zgloszenie.type})
                  </Link>{" "}
                  <span className="text-xs text-muted">z {formatDateTime(zgloszenie.createdAt)}</span>
                </dd>
              </>
            )}
            {/* Każda zgoda osobno — przy kontroli trzeba pokazać, na co i kiedy zgodziła się ta osoba. */}
            <dt className="text-muted">Zgoda: dane + trenerki</dt>
            <dd>
              {formatDateTime(lead.rodoConsentAt)}
              {zgloszenie && (
                <span className="block text-xs text-muted">
                  odebrana przy uzupełnianiu zgłoszenia — osobno od zgody na kontakt
                </span>
              )}
            </dd>
            <dt className="text-muted">Zgoda: telefon / SMS</dt>
            <dd>
              {lead.contactConsentAt ? (
                formatDateTime(lead.contactConsentAt)
              ) : (
                <span className="text-red-700">brak — nie dzwonić</span>
              )}
            </dd>
            <dt className="text-muted">Zgoda: marketing e-mail</dt>
            <dd>{lead.marketingConsentAt ? formatDateTime(lead.marketingConsentAt) : "—"}</dd>
            <dt className="text-muted">Wersja klauzul</dt>
            <dd className="text-xs">{lead.consentVersion ?? "—"}</dd>
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
        </Item>

        {/* PRZYDZIAŁY */}
        <Item className={drawer ? "card p-5" : "card p-6"}>
          <h2 className="font-serif text-lg font-semibold">Przydzielone trenerki ({assignments.length})</h2>
          <div className="mt-4 space-y-3">
            {assignments.map(({ assignment, trainer }) => (
              <div key={assignment.id} className="rounded-[10px] border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{trainer.name}</p>
                    <p className="text-xs text-muted">
                      {trainer.city ?? "—"}
                      {showBilling && <> · {trainer.billingModel === "per_lead" ? "za lead" : "za zapis"} · stawka {formatPln(trainer.rate)}</>}
                    </p>
                  </div>
                  <UnassignButton leadId={lead.id} trainerId={trainer.id} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <AssignmentStatusSelect assignmentId={assignment.id} current={assignment.status} />
                  {showBilling && (
                    <span className="text-muted">Naliczono: <strong className="text-money-dark">{formatPln(assignment.amount)}</strong></span>
                  )}
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
        </Item>
      </Wrap>

      {/* KORESPONDENCJA TRENEREK — tylko odczyt */}
      <Item className={drawer ? "card p-5" : "card mt-6 p-6"}>
        <h2 className="font-serif text-lg font-semibold">Korespondencja trenerek z kursantką ({korespondencja.length})</h2>
        <p className="mt-1 text-xs text-muted">Podgląd tylko do odczytu. Treść notatek trenerek nie jest tu pokazywana.</p>
        <ul className="mt-4 space-y-3 text-sm">
          {korespondencja.map((m) => {
            const trainerName = assignments.find((a) => a.assignment.id === m.assignmentId)?.trainer.name ?? `trenerka #${m.trainerId}`;
            return (
              <li key={m.id} className="rounded-[10px] border border-gray-100 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="font-semibold text-ink-soft">{trainerName}</span>
                  <span>{m.channel === "sms" ? "SMS" : "E-mail"} do {m.toAddress}</span>
                  <span>{formatDateTime(m.createdAt)}</span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${m.status === "blad" ? "bg-red-50 text-red-700" : m.status === "dry-run" ? "bg-amber-100 text-amber-900" : "bg-sand-100 text-sand-700"}`}>
                    {m.status === "dry-run" ? "tryb testowy, nie wysłano" : m.status}
                  </span>
                </div>
                {m.subject && <p className="mt-1 font-medium">{m.subject}</p>}
                <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                {m.error && <p className="mt-1 text-xs text-red-700">{m.error}</p>}
              </li>
            );
          })}
          {korespondencja.length === 0 && <li className="text-muted">Żadna trenerka nie pisała jeszcze do tej kursantki z panelu.</li>}
        </ul>
      </Item>

      {/* AUDIT LOG */}
      <Item className={drawer ? "card p-5" : "card mt-6 p-6"}>
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
      </Item>
    </div>
  );
}

/** W panelu bloki idą jeden pod drugim (rodzic ma `space-y`); na stronie — siatka dwóch kolumn. */
function Wrap({ drawer, className, children }: { drawer: boolean; className: string; children: ReactNode }) {
  return drawer ? <Fragment>{children}</Fragment> : <div className={className}>{children}</div>;
}

function BrakLeada() {
  return <p className="text-sm text-muted">Nie ma takiej kursantki — mogła zostać usunięta.</p>;
}

function formatDateTimeSafe(d: Date | null) {
  return d ? formatDateTime(d) : "—";
}
