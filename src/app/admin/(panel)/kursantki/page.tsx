import Link from "next/link";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Lead, Submission } from "@/db/schema";
import { RevealContact } from "@/components/admin/RevealContact";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { SubmissionToggle } from "@/components/admin/SubmissionToggle";
import { formatDateTime, maskEmail, maskPhone } from "@/lib/utils";
import {
  CATEGORIES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_STATUSES_CLOSED,
  LEAD_STATUSES_OPEN,
  LEAD_STATUS_LABELS,
  SOURCE_LABELS,
  SUBMISSION_TYPES,
  SUBMISSION_TYPE_LABELS,
  VOIVODESHIPS,
  voivodeshipName,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * JEDNO OKNO KURSANTEK.
 *
 * Leady i zgłoszenia to dwie tabele (patrz komentarz przy `submissions` w schemacie —
 * powód jest prawny), ale dla obsługi to jedna kolejka i jedna droga: każdy kontakt ma
 * dojść do przydziału trenerce. Ta strona zestawia oba źródła na wspólnej osi czasu
 * i pokazuje wprost, czego brakuje, żeby zgłoszenie stało się przychodem.
 *
 * Filtry kwalifikacyjne (status leada, województwo, kategoria, przydział) z natury
 * dotyczą wyłącznie leadów — gdy któryś jest aktywny, zgłoszeń nie pobieramy wcale
 * i mówimy o tym wprost, zamiast po cichu pokazywać pustą listę.
 */

const MAX_ROWS = 300;

type Row =
  | { kind: "lead"; id: number; createdAt: Date; lead: Lead }
  | { kind: "submission"; id: number; createdAt: Date; submission: Submission };

export default async function KursantkiPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const typ = ["lead", "zgloszenie"].includes(str("typ")) ? str("typ") : "";
  const zrodlo = str("zrodlo");
  const leadSource = zrodlo.startsWith("lead:") ? zrodlo.slice(5) : "";
  const submissionType = zrodlo.startsWith("zgl:") ? zrodlo.slice(4) : "";
  const status = (LEAD_STATUSES as readonly string[]).includes(str("status")) ? str("status") : "";
  const woj = VOIVODESHIPS.some((v) => v.slug === str("wojewodztwo")) ? str("wojewodztwo") : "";
  const kategoria = (CATEGORIES as readonly string[]).includes(str("kategoria")) ? str("kategoria") : "";
  const stan = ["do_zrobienia", "obsluzone"].includes(str("stan")) ? str("stan") : "";
  const przydzial = ["brak", "jest"].includes(str("przydzial")) ? str("przydzial") : "";
  const q = str("q").trim().slice(0, 100);
  const from = str("od");
  const to = str("do");

  // Filtry, których zgłoszenie nie jest w stanie spełnić — bo nie ma tych danych.
  const leadOnlyFilter = Boolean(status || woj || kategoria || przydzial || leadSource);
  const pobierzLeady = typ !== "zgloszenie" && !submissionType;
  const pobierzZgloszenia = typ !== "lead" && !leadOnlyFilter;

  const db = await getDb();

  // --- LEADY ---
  const leadConditions: SQL[] = [];
  if (status) leadConditions.push(eq(schema.leads.status, status as (typeof LEAD_STATUSES)[number]));
  if (stan === "do_zrobienia") leadConditions.push(inArray(schema.leads.status, [...LEAD_STATUSES_OPEN]));
  if (stan === "obsluzone") leadConditions.push(inArray(schema.leads.status, [...LEAD_STATUSES_CLOSED]));
  if (leadSource) leadConditions.push(eq(schema.leads.source, leadSource as (typeof LEAD_SOURCES)[number]));
  if (woj) leadConditions.push(eq(schema.leads.voivodeship, woj));
  if (kategoria) leadConditions.push(eq(schema.leads.category, kategoria));
  if (from) leadConditions.push(gte(schema.leads.createdAt, new Date(from)));
  if (to) leadConditions.push(lte(schema.leads.createdAt, new Date(to + "T23:59:59")));
  if (q) {
    leadConditions.push(
      or(
        ilike(schema.leads.name, `%${q}%`),
        ilike(schema.leads.email, `%${q}%`),
        ilike(schema.leads.phone, `%${q}%`)
      )!
    );
  }

  // --- ZGŁOSZENIA ---
  const subConditions: SQL[] = [];
  if (submissionType) {
    subConditions.push(eq(schema.submissions.type, submissionType as (typeof SUBMISSION_TYPES)[number]));
  }
  if (stan === "do_zrobienia") subConditions.push(eq(schema.submissions.isHandled, false));
  if (stan === "obsluzone") subConditions.push(eq(schema.submissions.isHandled, true));
  if (from) subConditions.push(gte(schema.submissions.createdAt, new Date(from)));
  if (to) subConditions.push(lte(schema.submissions.createdAt, new Date(to + "T23:59:59")));
  if (q) {
    subConditions.push(
      or(
        ilike(schema.submissions.name, `%${q}%`),
        ilike(schema.submissions.email, `%${q}%`),
        ilike(schema.submissions.phone, `%${q}%`)
      )!
    );
  }

  const [leadRows, submissionRows, assignments, converted, liczniki] = await Promise.all([
    pobierzLeady
      ? db
          .select()
          .from(schema.leads)
          .where(leadConditions.length ? and(...leadConditions) : undefined)
          .orderBy(desc(schema.leads.createdAt))
          .limit(MAX_ROWS)
      : Promise.resolve([] as Lead[]),
    pobierzZgloszenia
      ? db
          .select()
          .from(schema.submissions)
          .where(subConditions.length ? and(...subConditions) : undefined)
          .orderBy(desc(schema.submissions.createdAt))
          .limit(MAX_ROWS)
      : Promise.resolve([] as Submission[]),
    db
      .select({ leadId: schema.leadAssignments.leadId, trainerName: schema.trainers.name })
      .from(schema.leadAssignments)
      .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id)),
    // Ślad konwersji w obie strony: zgłoszenie wie o leadzie, a lista leadów
    // ma pokazać, który lead nie przyszedł z formularza, tylko z rozmowy.
    db
      .select({ submissionId: schema.submissions.id, leadId: schema.submissions.convertedToLeadId })
      .from(schema.submissions)
      .where(sql`${schema.submissions.convertedToLeadId} is not null`),
    liczLiczniki(db),
  ]);

  const assignedBy = new Map<number, string[]>();
  for (const a of assignments) {
    const list = assignedBy.get(a.leadId) ?? [];
    list.push(a.trainerName);
    assignedBy.set(a.leadId, list);
  }

  const leadFromSubmission = new Map<number, number>();
  for (const c of converted) if (c.leadId) leadFromSubmission.set(c.leadId, c.submissionId);

  // Filtr przydziału działa po pobraniu — mapa przydziałów i tak jest potrzebna do tabeli,
  // więc drugie zapytanie do bazy nic by nie dało.
  const leadyPoPrzydziale = leadRows.filter((l) => {
    if (przydzial === "brak") return !assignedBy.has(l.id);
    if (przydzial === "jest") return assignedBy.has(l.id);
    return true;
  });

  const rows: Row[] = [
    ...leadyPoPrzydziale.map((l): Row => ({ kind: "lead", id: l.id, createdAt: l.createdAt, lead: l })),
    ...submissionRows.map((s): Row => ({ kind: "submission", id: s.id, createdAt: s.createdAt, submission: s })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_ROWS);

  const liczbaLeadow = rows.filter((r) => r.kind === "lead").length;
  const liczbaZgloszen = rows.length - liczbaLeadow;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">
            Kursantki <span className="text-base font-normal text-muted">({rows.length})</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Leady i zgłoszenia na jednej osi czasu. Lead jest gotowy do przydziału trenerce; zgłoszenie
            nie ma kwalifikacji, więc dopóki go nie uzupełnisz, nie da się na nim zarobić.
          </p>
        </div>
        <a href="/api/admin/leads/export" className="btn-outline !px-4 !py-2 !text-sm">Eksport leadów CSV</a>
      </div>

      {/* LICZNIKI */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <LicznikKarta
          href="/admin/kursantki?stan=do_zrobienia"
          label="Do obsłużenia"
          value={liczniki.doObsluzenia}
          hint="otwarte leady + nieobsłużone zgłoszenia"
        />
        <LicznikKarta
          href="/admin/kursantki?typ=lead&przydzial=brak"
          label="Leady bez przydziału"
          value={liczniki.leadyBezPrzydzialu}
          hint="mają komplet danych, nie mają trenerki"
          alarm={liczniki.leadyBezPrzydzialu > 0}
        />
        <LicznikKarta
          href="/admin/kursantki?typ=zgloszenie&stan=do_zrobienia"
          label="Zgłoszenia do uzupełnienia"
          value={liczniki.zgloszeniaDoUzupelnienia}
          hint="czekają na kwalifikację"
          alarm={liczniki.zgloszeniaDoUzupelnienia > 0}
        />
      </div>

      {liczniki.zgloszeniaBezKwalifikacji > 0 && (
        <p className="mt-3 text-sm text-muted">
          W całej bazie <strong className="text-ink-soft">{liczniki.zgloszeniaBezKwalifikacji}</strong>{" "}
          {liczniki.zgloszeniaBezKwalifikacji === 1 ? "zgłoszenie nigdy nie dostało" : "zgłoszeń nigdy nie dostało"}{" "}
          kwalifikacji — bez województwa i kategorii nie da się ich przydzielić, więc są warte 0 zł.
        </p>
      )}

      {/* FILTRY */}
      <form method="GET" className="card mt-5 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        <input type="search" name="q" defaultValue={q} placeholder="Szukaj (imię/email/tel)" className="input !py-2 !text-sm" aria-label="Szukaj" />
        <select name="typ" defaultValue={typ} className="input !py-2 !text-sm" aria-label="Typ wpisu">
          <option value="">Typ: wszystko</option>
          <option value="lead">Tylko leady</option>
          <option value="zgloszenie">Tylko zgłoszenia</option>
        </select>
        <select name="zrodlo" defaultValue={zrodlo} className="input !py-2 !text-sm" aria-label="Źródło">
          <option value="">Źródło: wszystkie</option>
          <optgroup label="Lead">
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={`lead:${s}`}>{SOURCE_LABELS[s]}</option>
            ))}
          </optgroup>
          <optgroup label="Zgłoszenie">
            {SUBMISSION_TYPES.map((t) => (
              <option key={t} value={`zgl:${t}`}>{SUBMISSION_TYPE_LABELS[t]}</option>
            ))}
          </optgroup>
        </select>
        <select name="stan" defaultValue={stan} className="input !py-2 !text-sm" aria-label="Stan obsługi">
          <option value="">Stan: wszystko</option>
          <option value="do_zrobienia">Do zrobienia</option>
          <option value="obsluzone">Obsłużone</option>
        </select>
        <select name="status" defaultValue={status} className="input !py-2 !text-sm" aria-label="Status leada">
          <option value="">Status leada: wszystkie</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select name="wojewodztwo" defaultValue={woj} className="input !py-2 !text-sm" aria-label="Województwo">
          <option value="">Woj.: wszystkie</option>
          {VOIVODESHIPS.map((v) => (
            <option key={v.slug} value={v.slug}>{v.name}</option>
          ))}
        </select>
        <select name="kategoria" defaultValue={kategoria} className="input !py-2 !text-sm" aria-label="Kategoria">
          <option value="">Kategoria: wszystkie</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select name="przydzial" defaultValue={przydzial} className="input !py-2 !text-sm" aria-label="Przydział">
          <option value="">Przydział: wszystko</option>
          <option value="brak">Bez przydziału</option>
          <option value="jest">Z przydziałem</option>
        </select>
        <input type="date" name="od" defaultValue={from} className="input !py-2 !text-sm" aria-label="Data od" />
        <div className="flex gap-2">
          <input type="date" name="do" defaultValue={to} className="input !py-2 !text-sm" aria-label="Data do" />
          <button type="submit" className="btn-primary !px-4 !py-2 !text-sm">OK</button>
        </div>
      </form>

      {leadOnlyFilter && typ !== "lead" && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Wybrany filtr (status leada, województwo, kategoria, przydział albo źródło leada) dotyczy danych,
          których zgłoszenia nie mają — dlatego widzisz wyłącznie leady.{" "}
          <Link href="/admin/kursantki?typ=zgloszenie" className="font-semibold underline">
            Pokaż same zgłoszenia
          </Link>
        </p>
      )}

      <p className="mt-4 text-sm text-muted">
        W widoku: <strong className="text-ink-soft">{liczbaLeadow}</strong> leadów ·{" "}
        <strong className="text-ink-soft">{liczbaZgloszen}</strong> zgłoszeń
        {rows.length === MAX_ROWS ? " (limit 300 — zawęź filtry)" : ""}
      </p>

      <div className="card mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Typ</th>
              <th className="px-4 py-3 font-semibold">Imię i nazwisko</th>
              <th className="px-4 py-3 font-semibold">Kontakt</th>
              <th className="px-4 py-3 font-semibold">Źródło</th>
              <th className="px-4 py-3 font-semibold">Kwalifikacja</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Przydział / akcja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) =>
              row.kind === "lead" ? (
                <WierszLeada
                  key={`l-${row.id}`}
                  lead={row.lead}
                  trenerki={assignedBy.get(row.id) ?? []}
                  zeZgloszenia={leadFromSubmission.get(row.id)}
                />
              ) : (
                <WierszZgloszenia key={`z-${row.id}`} submission={row.submission} />
              )
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  Brak wpisów dla wybranych filtrów.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== LICZNIKI ===== */

async function liczLiczniki(db: Awaited<ReturnType<typeof getDb>>) {
  const [openLeads, unhandledSubs, unqualifiedSubs, unassignedLeads, neverQualified] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(inArray(schema.leads.status, [...LEAD_STATUSES_OPEN])),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.submissions)
      .where(eq(schema.submissions.isHandled, false)),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.submissions)
      .where(and(eq(schema.submissions.isHandled, false), isNull(schema.submissions.convertedToLeadId))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.leads)
      .leftJoin(schema.leadAssignments, eq(schema.leadAssignments.leadId, schema.leads.id))
      .where(isNull(schema.leadAssignments.id)),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.submissions)
      .where(isNull(schema.submissions.convertedToLeadId)),
  ]);

  return {
    doObsluzenia: (openLeads[0]?.c ?? 0) + (unhandledSubs[0]?.c ?? 0),
    leadyBezPrzydzialu: unassignedLeads[0]?.c ?? 0,
    zgloszeniaDoUzupelnienia: unqualifiedSubs[0]?.c ?? 0,
    zgloszeniaBezKwalifikacji: neverQualified[0]?.c ?? 0,
  };
}

function LicznikKarta({
  href,
  label,
  value,
  hint,
  alarm,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  alarm?: boolean;
}) {
  return (
    <Link href={href} className={`card p-4 transition-shadow ${alarm ? "ring-1 ring-amber-300" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl font-bold text-ink-soft">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </Link>
  );
}

/* ===== WIERSZE ===== */

function WierszLeada({
  lead,
  trenerki,
  zeZgloszenia,
}: {
  lead: Lead;
  trenerki: string[];
  zeZgloszenia?: number;
}) {
  return (
    <tr className="align-top hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(lead.createdAt)}</td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full bg-money-bg px-2.5 py-0.5 text-[11px] font-bold text-money-dark">
          Lead
        </span>
      </td>
      <td className="px-4 py-3 font-medium">
        <Link href={`/admin/kursantki/${lead.id}`} className="text-sand-700 hover:underline">
          {lead.name}
        </Link>
        {zeZgloszenia && (
          <span className="mt-0.5 block text-[11px] text-muted">
            z uzupełnienia zgłoszenia #{zeZgloszenia}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {lead.anonymizedAt ? (
          <span className="text-xs italic text-muted">zanonimizowano (RODO)</span>
        ) : (
          <div className="space-y-1">
            <div><RevealContact masked={maskPhone(lead.phone)} full={lead.phone} /></div>
            <div><RevealContact masked={maskEmail(lead.email)} full={lead.email} /></div>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted">{SOURCE_LABELS[lead.source] ?? lead.source}</td>
      <td className="px-4 py-3">
        <span className="block">{lead.category}</span>
        <span className="block text-xs text-muted">{voivodeshipName(lead.voivodeship)}</span>
      </td>
      <td className="px-4 py-3"><LeadStatusSelect leadId={lead.id} current={lead.status} /></td>
      <td className="px-4 py-3 text-xs">{trenerki.join(", ") || <span className="text-muted">—</span>}</td>
    </tr>
  );
}

function WierszZgloszenia({ submission }: { submission: Submission }) {
  const przekonwertowane = Boolean(submission.convertedToLeadId);
  return (
    <tr className="align-top bg-amber-50/30 hover:bg-amber-50/60">
      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(submission.createdAt)}</td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
          Zgłoszenie
        </span>
      </td>
      <td className="px-4 py-3 font-medium">
        <Link href={`/admin/kursantki/zgloszenie/${submission.id}`} className="text-sand-700 hover:underline">
          {submission.name}
        </Link>
        {submission.message && (
          <span className="mt-0.5 line-clamp-2 block max-w-[220px] text-[11px] text-muted">
            {submission.message}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div><RevealContact masked={maskEmail(submission.email)} full={submission.email} /></div>
          {submission.phone ? (
            <div><RevealContact masked={maskPhone(submission.phone)} full={submission.phone} /></div>
          ) : (
            <div className="text-xs italic text-muted">brak telefonu</div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {SUBMISSION_TYPE_LABELS[submission.type] ?? submission.type}
      </td>
      <td className="px-4 py-3 text-xs italic text-muted">brak kwalifikacji</td>
      <td className="px-4 py-3">
        {przekonwertowane ? (
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            Przekonwertowane
          </span>
        ) : (
          <SubmissionToggle id={submission.id} isHandled={submission.isHandled} />
        )}
      </td>
      <td className="px-4 py-3">
        {przekonwertowane ? (
          <Link
            href={`/admin/kursantki/${submission.convertedToLeadId}`}
            className="text-xs font-semibold text-sand-700 hover:underline"
          >
            → lead #{submission.convertedToLeadId}
          </Link>
        ) : (
          <Link
            href={`/admin/kursantki/zgloszenie/${submission.id}`}
            className="inline-flex items-center rounded-full border-2 border-sand-600 px-3 py-1 text-xs font-bold text-sand-700 transition-colors hover:bg-sand-50"
          >
            Uzupełnij do leada
          </Link>
        )}
      </td>
    </tr>
  );
}
