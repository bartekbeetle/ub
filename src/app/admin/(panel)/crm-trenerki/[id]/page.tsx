import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ProspectForm } from "@/components/admin/ProspectForm";
import { ProspectStatusSelect } from "@/components/admin/ProspectStatusSelect";
import { ProspectActivityForm } from "@/components/admin/ProspectActivityForm";
import { ProspectNextActionForm } from "@/components/admin/ProspectNextActionForm";
import { ProspectQuickActions } from "@/components/admin/ProspectQuickActions";
import { PromoteProspectButton } from "@/components/admin/PromoteProspectButton";
import { DeleteRecordButton } from "@/components/admin/DeleteRecordButton";
import { getMatchingUnassignedLeads, prospectVoivodeships, warsawCalendarDaysDiff } from "@/lib/prospects";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  BUR_SEGMENT_COLORS,
  BUR_SEGMENT_LABELS,
  BUR_SEGMENT_SHORT,
  PROSPECT_ACTIVITY_LABELS,
  PROSPECT_PRIORITY_COLORS,
  PROSPECT_PRIORITY_LABELS,
  PROSPECT_SOURCE_LABELS,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  burProviderUrl,
  voivodeshipName,
} from "@/lib/constants";

export const dynamic = "force-dynamic";


/** `tel:` chce samych cyfr i ewentualnego `+` — numery w bazie bywają wpisane ze spacjami. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export default async function ProspektPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prospectId = Number(id);
  if (!Number.isInteger(prospectId)) notFound();

  const db = await getDb();
  const rows = await db
    .select({ prospect: schema.prospects, trainer: schema.trainers, lead: schema.leads })
    .from(schema.prospects)
    .leftJoin(schema.trainers, eq(schema.prospects.trainerId, schema.trainers.id))
    .leftJoin(schema.leads, eq(schema.prospects.triggeredByLeadId, schema.leads.id))
    .where(eq(schema.prospects.id, prospectId))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  const { prospect, trainer, lead } = row;

  const activities = await db
    .select()
    .from(schema.prospectActivities)
    .where(eq(schema.prospectActivities.prospectId, prospectId))
    .orderBy(desc(schema.prospectActivities.createdAt));

  const burLink = prospect.burUrl || burProviderUrl(prospect.burProviderId);
  const matchingLeads = await getMatchingUnassignedLeads(prospect);
  const matchVoivs = prospectVoivodeships(prospect);

  return (
    <div className="max-w-5xl">
      <Link href="/admin/crm-trenerki" className="text-sm font-semibold text-sand-700 hover:underline">← Wróć do CRM</Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">
            {prospect.name}
            <span className={`ml-3 inline-flex rounded-full px-3 py-1 align-middle text-xs font-bold ${PROSPECT_STATUS_COLORS[prospect.status]}`}>
              {PROSPECT_STATUS_LABELS[prospect.status]}
            </span>
            <span className={`ml-2 inline-flex rounded-full px-3 py-1 align-middle text-xs font-bold ${BUR_SEGMENT_COLORS[prospect.burSegment]}`}>
              {BUR_SEGMENT_SHORT[prospect.burSegment]}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {prospect.city ?? "—"}
            {prospect.voivodeship ? `, ${voivodeshipName(prospect.voivodeship)}` : ""} ·{" "}
            {PROSPECT_SOURCE_LABELS[prospect.source] ?? prospect.source} · dodany {formatDateTime(prospect.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ProspectStatusSelect prospectId={prospect.id} current={prospect.status} />
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${PROSPECT_PRIORITY_COLORS[prospect.priority]}`}>
            Priorytet: {PROSPECT_PRIORITY_LABELS[prospect.priority]}
          </span>
          {prospect.status !== "umowa" && prospect.status !== "aktywna" && (
            <DeleteRecordButton
              id={prospect.id}
              kind="prospekt"
              name={prospect.name}
              redirectTo="/admin/crm-trenerki"
            />
          )}
        </div>
      </div>

      {/* KONTAKT I NASTĘPNY RUCH */}
      <div className="card mt-6 p-5">
        <h2 className="font-serif text-lg font-semibold">Kontakt i następny ruch</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ostatni kontakt</p>
            <p className="mt-1 text-sm">
              {prospect.lastContactAt
                ? `${formatDateTime(prospect.lastContactAt)} (${warsawCalendarDaysDiff(prospect.lastContactAt)} dni temu)`
                : "nigdy"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Następny ruch</p>
            {prospect.nextActionAt ? (
              <p className="mt-1 text-sm">
                {formatDate(prospect.nextActionAt)}
                {warsawCalendarDaysDiff(prospect.nextActionAt) > 0 && (
                  <span className="ml-2 font-semibold text-red-700">
                    zaległe o {warsawCalendarDaysDiff(prospect.nextActionAt)} dni
                  </span>
                )}
                {prospect.nextActionNote && <span className="block text-muted">{prospect.nextActionNote}</span>}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Nie ustalono.</p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <ProspectQuickActions prospectId={prospect.id} />
        </div>
        <ProspectNextActionForm
          prospectId={prospect.id}
          nextActionAt={prospect.nextActionAt}
          nextActionNote={prospect.nextActionNote}
        />
      </div>

      {/* AWANS DO KATALOGU */}
      <div className="card mt-6 border border-sand-200 p-5">
        <h2 className="font-serif text-lg font-semibold">Profil w katalogu publicznym</h2>
        {trainer ? (
          <p className="mt-2 text-sm">
            Profil istnieje:{" "}
            <Link href={`/admin/trenerki/${trainer.id}`} className="font-semibold text-sand-700 hover:underline">
              {trainer.name}
            </Link>{" "}
            <span className="text-muted">
              ({trainer.isActive ? "widoczny w serwisie" : "ukryty"} ·{" "}
              {trainer.autoAssign ? "auto-przydział leadów WŁĄCZONY" : "auto-przydział wyłączony"})
            </span>
          </p>
        ) : prospect.status === "umowa" ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">
              Umowa podpisana — możesz utworzyć profil. Powstanie jako <strong>ukryty</strong> i <strong>bez
              automatycznego przydziału leadów</strong>; jedno i drugie włączasz ręcznie po uzupełnieniu profilu.
            </p>
            <PromoteProspectButton prospectId={prospect.id} name={prospect.name} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Profil publiczny powstaje dopiero przy statusie „Umowa”. Do tego czasu podmiot żyje wyłącznie w CRM
            i nie pojawia się nigdzie w serwisie.
          </p>
        )}
      </div>

      {/* LEADY OD RĘKI — kto z nieprzypisanych pasuje do jej kategorii i województwa */}
      <div className="card mt-6 border-2 border-money-bg p-5">
        <h2 className="font-serif text-lg font-semibold">
          Leady od ręki: {matchingLeads.length}
          {matchingLeads.length === 30 ? "+" : ""}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Kursantki bez przydziału z kategorii{" "}
          <strong>{prospect.categories.join(", ") || "— brak kategorii —"}</strong> i województw{" "}
          <strong>{matchVoivs.map(voivodeshipName).join(", ") || "— brak województwa —"}</strong>. Zasięg poszerzysz w
          polu „obsługiwane województwa”.
        </p>
        {matchingLeads.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {matchingLeads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/kursantki/${l.id}`} className="font-semibold text-sand-700 hover:underline">
                  {l.name}
                </Link>
                <span className="text-xs text-muted">
                  {l.match === "extra" ? (
                    <span className="font-semibold text-sand-700">
                      dodatkowa: {l.extraCategories.filter((c) => prospect.categories.includes(c)).join(", ")} (główna: {l.category})
                    </span>
                  ) : (
                    l.category
                  )}{" "}
                  · {l.city ? `${l.city}, ` : ""}
                  {voivodeshipName(l.voivodeship)} · {formatDate(l.createdAt)}
                  {!l.contactConsentAt && <span className="ml-2 font-semibold text-red-700">brak zgody na telefon</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* DANE + BUR */}
        <div className="card p-6">
          <h2 className="font-serif text-lg font-semibold">Dane podmiotu</h2>
          <dl className="mt-4 grid grid-cols-[130px_1fr] gap-y-2.5 text-sm">
            <dt className="text-muted">Nazwa z rejestru</dt>
            <dd>{prospect.legalName ?? "—"}</dd>
            <dt className="text-muted">NIP</dt>
            <dd className="font-mono text-sm">{prospect.nip ?? "—"}</dd>
            <dt className="text-muted">KRS</dt>
            <dd className="font-mono text-sm">{prospect.krs ?? "—"}</dd>
            <dt className="text-muted">Telefon</dt>
            <dd>{prospect.phone ? <a href={telHref(prospect.phone)} className="text-sand-700 hover:underline">{prospect.phone}</a> : "—"}</dd>
            <dt className="text-muted">E-mail</dt>
            <dd className="break-all">{prospect.email ? <a href={`mailto:${prospect.email}`} className="text-sand-700 hover:underline">{prospect.email}</a> : "—"}</dd>
            <dt className="text-muted">Osoby</dt>
            <dd>
              {prospect.contacts.length === 0 && "—"}
              <ul className="space-y-2">
                {prospect.contacts.map((c, i) => (
                  <li key={i}>
                    <span className="font-semibold">{c.name}</span>
                    {c.role && <span className="text-muted"> · {c.role}</span>}
                    <span className="block text-xs">
                      {c.phone && <a href={telHref(c.phone)} className="mr-3 text-sand-700 hover:underline">{c.phone}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="break-all text-sand-700 hover:underline">{c.email}</a>}
                    </span>
                    {c.note && <span className="block text-xs text-muted">{c.note}</span>}
                  </li>
                ))}
              </ul>
            </dd>
            <dt className="text-muted">Kategorie</dt>
            <dd>{prospect.categories.join(", ") || "—"}</dd>
            <dt className="text-muted">Linki</dt>
            <dd className="space-x-3 text-sm">
              {prospect.website && <a href={prospect.website} target="_blank" rel="noreferrer" className="text-sand-700 hover:underline">WWW</a>}
              {prospect.instagram && <a href={prospect.instagram} target="_blank" rel="noreferrer" className="text-sand-700 hover:underline">Instagram</a>}
              {prospect.facebook && <a href={prospect.facebook} target="_blank" rel="noreferrer" className="text-sand-700 hover:underline">Facebook</a>}
              {prospect.links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-sand-700 hover:underline">{l.label}</a>
              ))}
              {!prospect.website && !prospect.instagram && !prospect.facebook && prospect.links.length === 0 && "—"}
            </dd>
          </dl>

          <h3 className="mt-6 font-serif text-base font-semibold">
            BUR — {BUR_SEGMENT_LABELS[prospect.burSegment]}
          </h3>
          <dl className="mt-3 grid grid-cols-[130px_1fr] gap-y-2.5 text-sm">
            <dt className="text-muted">Karta dostawcy</dt>
            <dd>
              {burLink ? (
                <a href={burLink} target="_blank" rel="noreferrer" className="text-sand-700 hover:underline">
                  Otwórz w PARP{prospect.burProviderId ? ` (ID ${prospect.burProviderId})` : ""}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted">Usługi</dt>
            <dd>
              {prospect.burServicesCompleted ?? "—"} zrealizowanych · {prospect.burServicesActive ?? "—"} aktywnych
            </dd>
            <dt className="text-muted">Ocena</dt>
            <dd>
              {prospect.burRatingX10 ? `${(prospect.burRatingX10 / 10).toFixed(1)} / 5` : "—"}
              {prospect.burReviewCount ? ` (${prospect.burReviewCount} opinii)` : ""}
            </dd>
            <dt className="text-muted">Sprawdzone</dt>
            <dd>{prospect.burCheckedAt ? formatDateTime(prospect.burCheckedAt) : "—"}</dd>
          </dl>
        </div>

        {/* RESEARCH */}
        <div className="card p-6">
          <h2 className="font-serif text-lg font-semibold">Research</h2>
          <dl className="mt-4 grid grid-cols-[130px_1fr] gap-y-2.5 text-sm">
            <dt className="text-muted">Dossier</dt>
            <dd className="break-all font-mono text-xs">{prospect.dossierPath ?? "—"}</dd>
            <dt className="text-muted">Zaktualizowany</dt>
            <dd>{prospect.researchedAt ? formatDateTime(prospect.researchedAt) : "—"}</dd>
            <dt className="text-muted">Powód researchu</dt>
            <dd>
              {lead ? (
                <Link href={`/admin/kursantki/${lead.id}`} className="text-sand-700 hover:underline">
                  Lead #{lead.id} — {lead.category}, {voivodeshipName(lead.voivodeship)}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </dl>
          <div className="mt-4 whitespace-pre-wrap rounded-[10px] bg-gray-50 p-4 text-sm">
            {prospect.researchNotes?.trim() || <span className="text-muted">Brak notatek z researchu.</span>}
          </div>
        </div>
      </div>

      {/* OŚ CZASU */}
      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Historia kontaktu ({activities.length})</h2>
        <div className="mt-4">
          <ProspectActivityForm prospectId={prospect.id} />
        </div>
        <ul className="mt-6 space-y-3 text-sm">
          {activities.map((a) => (
            <li key={a.id} className="border-l-2 border-sand-200 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-bold text-sand-700">
                  {PROSPECT_ACTIVITY_LABELS[a.type] ?? a.type}
                </span>
                <span className="text-xs text-muted">{formatDateTime(a.createdAt)} · {a.createdBy}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{a.content}</p>
            </li>
          ))}
          {activities.length === 0 && <li className="text-muted">Brak wpisów — jeszcze nikt się nie odzywał.</li>}
        </ul>
      </div>

      {/* EDYCJA */}
      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Edytuj dane</h2>
        <div className="mt-4">
          <ProspectForm prospect={prospect} />
        </div>
      </div>
    </div>
  );
}
