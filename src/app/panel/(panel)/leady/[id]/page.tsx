import { crmTrenerkiEnabled } from "@/lib/crm-flag";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTrainerPage } from "@/lib/crm-page";
import { CRM_STAGE_COLORS, CRM_STAGE_LABELS, dailyUsage, getCrmDetail, listTemplates, templateVars } from "@/lib/crm-core";
import { getDb } from "@/db";
import { isSmsLive } from "@/lib/sms";
import { formatDateTime } from "@/lib/utils";
import { voivodeshipName } from "@/lib/constants";
import { StageControl } from "@/components/panel/crm/StageControl";
import { ReminderForm } from "@/components/panel/crm/ReminderForm";
import { NoteForm } from "@/components/panel/crm/NoteForm";
import { Composer } from "@/components/panel/crm/Composer";
import { QuizAnswers } from "@/components/admin/QuizAnswers";

export const dynamic = "force-dynamic";

const MSG_STATUS: Record<string, string> = {
  w_kolejce: "w kolejce wysyłki",
  wyslany: "wysłano",
  blad: "błąd wysyłki",
  "dry-run": "tryb testowy, nie wysłano",
};

const TYPE_LABEL = { notatka: "Notatka", etap: "Zmiana etapu", przypomnienie: "Przypomnienie", email: "E-mail", sms: "SMS" } as const;

export default async function KartaKursantkiPage({ params }: { params: Promise<{ id: string }> }) {
  // BRAMKA przed jakimkolwiek zapytaniem: przekierowanie, nie podmiana widoku.
  if (!crmTrenerkiEnabled()) notFound();
  const { user, trainerId } = await requireTrainerPage();
  const { id } = await params;
  const assignmentId = Number(id);
  if (!Number.isInteger(assignmentId) || assignmentId <= 0) notFound();

  const db = await getDb();
  // IZOLACJA: getCrmDetail łączy przydział z trainerId z sesji. Cudzy przydział = null = 404.
  const detail = await getCrmDetail(db, trainerId, assignmentId);
  if (!detail) notFound();

  const [templates, usage] = await Promise.all([listTemplates(db, trainerId), dailyUsage(db, trainerId)]);
  const { lead } = detail;
  const vars = templateVars(lead);
  const smsBlockedReason = lead.anonymized
    ? "Zgłoszenie zanonimizowane (RODO)."
    : !lead.phoneConsent
      ? "Ta kursantka nie wyraziła zgody na kontakt telefoniczny i SMS. Napisz do niej e-mailem."
      : null;

  return (
    <div className="max-w-6xl">
      <Link href="/panel/leady" className="text-sm font-semibold text-sand-700 hover:underline">← Wróć do listy kursantek</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl font-bold">{lead.name}</h1>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${CRM_STAGE_COLORS[detail.stage]}`}>{CRM_STAGE_LABELS[detail.stage]}</span>
      </div>
      <p className="mt-1 text-sm text-muted">Przydzielona {formatDateTime(detail.createdAt)}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <section className="card p-6" aria-labelledby="crm-dane">
            <h2 id="crm-dane" className="font-serif text-lg font-semibold">Dane ze zgłoszenia</h2>
            <dl className="mt-4 grid grid-cols-[130px_1fr] gap-y-2.5 text-sm">
              <dt className="text-muted">Telefon</dt>
              <dd>{lead.anonymized ? "zanonimizowano (RODO)" : <a href={`tel:${lead.phone}`} className="font-medium text-sand-700 hover:underline">{lead.phone}</a>}</dd>
              <dt className="text-muted">E-mail</dt>
              <dd>{lead.anonymized ? "zanonimizowano (RODO)" : <a href={`mailto:${lead.email}`} className="text-sand-700 hover:underline">{lead.email}</a>}</dd>
              <dt className="text-muted">Zgoda na telefon i SMS</dt>
              <dd>{lead.phoneConsent ? "Tak" : <span className="font-semibold text-red-700">Brak. Kontakt tylko e-mailem.</span>}</dd>
              <dt className="text-muted">Szkolenie</dt>
              <dd>{lead.courseTitle ?? lead.category}</dd>
              <dt className="text-muted">Kategoria</dt>
              <dd>{lead.category}</dd>
              <dt className="text-muted">Lokalizacja</dt>
              <dd>{lead.city ? `${lead.city}, ` : ""}{voivodeshipName(lead.voivodeship)}</dd>
              <dt className="text-muted">Status zawodowy</dt>
              <dd>{lead.employmentStatus}</dd>
              <dt className="text-muted">Preferowany termin</dt>
              <dd>{lead.preferredDate ?? "Nie podano"}</dd>
              {lead.message && (
                <>
                  <dt className="text-muted">Wiadomość</dt>
                  <dd><QuizAnswers message={lead.message} /></dd>
                </>
              )}
            </dl>
          </section>

          <section className="card space-y-5 p-6" aria-labelledby="crm-etap">
            <h2 id="crm-etap" className="font-serif text-lg font-semibold">Etap i następny kontakt</h2>
            <StageControl assignmentId={assignmentId} current={detail.stage} />
            {detail.stage === "rezygnacja" && detail.rejectionReason && (
              <p className="text-sm text-red-700">Powód rezygnacji: {detail.rejectionReason}</p>
            )}
            <ReminderForm assignmentId={assignmentId} current={detail.nextContactAt} />
          </section>

          <section className="card p-6" aria-labelledby="crm-notatki">
            <h2 id="crm-notatki" className="sr-only">Notatki</h2>
            <NoteForm assignmentId={assignmentId} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-6" aria-labelledby="crm-wiadomosc">
            <h2 id="crm-wiadomosc" className="font-serif text-lg font-semibold">Wiadomość do kursantki</h2>
            <p className="mt-1 mb-4 text-sm text-muted">Piszesz do jednej osoby z jej karty. Wysyłka do wielu kursantek naraz nie jest dostępna.</p>
            <Composer
              assignmentId={assignmentId}
              vars={vars}
              canEmail={!lead.anonymized && Boolean(lead.email)}
              canSms={smsBlockedReason === null && Boolean(lead.phone)}
              smsBlockedReason={smsBlockedReason}
              smsLive={isSmsLive()}
              templates={templates.map((t) => ({ id: t.id, channel: t.channel === "sms" ? "sms" : "email", name: t.name, subject: t.subject, body: t.body }))}
              usage={usage}
            />
            <p className="mt-3 text-xs text-muted"><Link href="/panel/szablony" className="link-inline">Zarządzaj szablonami</Link> · konto: {user.email}</p>
          </section>

          <section className="card p-6" aria-labelledby="crm-os">
            <h2 id="crm-os" className="font-serif text-lg font-semibold">Historia kontaktu</h2>
            <ol className="mt-4 space-y-4">
              {detail.timeline.map((t) => (
                <li key={t.key} className="border-l-2 border-sand-300 pl-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-semibold text-ink-soft">{TYPE_LABEL[t.type]}</span>
                    <span>{formatDateTime(t.at)}</span>
                    {t.message && (
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${t.message.status === "blad" ? "bg-red-50 text-red-700" : t.message.status === "dry-run" ? "bg-amber-100 text-amber-900" : "bg-sand-100 text-sand-700"}`}>
                        {MSG_STATUS[t.message.status] ?? t.message.status}
                      </span>
                    )}
                  </div>
                  {t.message?.subject && <p className="mt-1 text-sm font-medium text-ink-soft">{t.message.subject}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{t.text}</p>
                  {t.message?.error && <p className="mt-1 text-xs text-red-700">{t.message.error}</p>}
                </li>
              ))}
              {detail.timeline.length === 0 && <li className="text-sm text-muted">Brak wpisów. Pierwsza notatka, zmiana etapu albo wiadomość pojawi się tutaj.</li>}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
