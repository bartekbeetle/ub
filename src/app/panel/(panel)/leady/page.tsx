import Link from "next/link";
import { requireTrainerPage } from "@/lib/crm-page";
import {
  CRM_STAGES,
  CRM_STAGE_COLORS,
  CRM_STAGE_LABELS,
  filterCrmList,
  isCrmStage,
  listCrmLeads,
  type CrmStage,
} from "@/lib/crm-core";
import { getDb } from "@/db";
import { formatDate, formatDateTime } from "@/lib/utils";
import { voivodeshipName } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SP = { etap?: string; q?: string; dzis?: string };

function href(sp: { etap?: string | null; q?: string | null; dzis?: boolean }) {
  const p = new URLSearchParams();
  if (sp.etap) p.set("etap", sp.etap);
  if (sp.q) p.set("q", sp.q);
  if (sp.dzis) p.set("dzis", "1");
  const s = p.toString();
  return s ? `/panel/leady?${s}` : "/panel/leady";
}

export default async function PanelLeadyPage({ searchParams }: { searchParams: Promise<SP> }) {
  // BRAMKA: sesja, hasło startowe i aktywacja konta, zanim ruszy jakiekolwiek zapytanie o kursantki.
  const { trainerId } = await requireTrainerPage();
  const sp = await searchParams;
  const etap: CrmStage | null = isCrmStage(sp.etap) ? sp.etap : null;
  const q = (sp.q ?? "").slice(0, 80);
  const dzis = sp.dzis === "1";

  // TWARDA IZOLACJA: tylko przydziały tej trenerki (`listCrmLeads` filtruje po trainer_id z sesji).
  const all = await listCrmLeads(await getDb(), trainerId);
  const rows = filterCrmList(all, { stage: etap, q, due: dzis });

  const counts = Object.fromEntries(CRM_STAGES.map((s) => [s, all.filter((i) => i.stage === s).length])) as Record<CrmStage, number>;
  const dueCount = all.filter((i) => i.due).length;
  const signed = counts.zapisana;
  const active = all.length - counts.rezygnacja;

  const chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors min-h-[36px] ${
      on ? "border-sand-700 bg-sand-700 text-white" : "border-sand-600 bg-white text-sand-700 hover:bg-sand-50"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">
          Moje kursantki <span className="text-base font-normal text-muted">({all.length})</span>
        </h1>
        <div className="flex gap-6 text-sm">
          <span className="text-muted">Aktywne: <strong className="text-ink-soft">{active}</strong></span>
          <span className="text-muted">Zapisane: <strong className="text-money-dark">{signed}</strong></span>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted">
        Kandydatki przydzielone do Twojej akademii. Skontaktuj się z każdą w ciągu 24 godzin. Etap, notatki, przypomnienia i korespondencję prowadzisz na karcie kursantki, a po zapisie na szkolenie ustaw etap <strong>„Zapisana”</strong>.
      </p>

      <form action="/panel/leady" method="get" className="mt-5 flex flex-wrap items-center gap-3" role="search">
        {etap && <input type="hidden" name="etap" value={etap} />}
        {dzis && <input type="hidden" name="dzis" value="1" />}
        <label htmlFor="crm-q" className="sr-only">Szukaj kursantki</label>
        <input id="crm-q" name="q" defaultValue={q} placeholder="Szukaj: imię, telefon, e-mail, miasto" className="input max-w-sm" />
        <button type="submit" className="btn-outline !px-5 !py-2 !text-sm">Szukaj</button>
        {(q || etap || dzis) && <Link href="/panel/leady" className="link-inline text-sm">Wyczyść filtry</Link>}
      </form>

      <nav aria-label="Filtr etapu" className="mt-4 flex flex-wrap gap-2">
        <Link href={href({ q })} className={chip(!etap && !dzis)}>Wszystkie <span className="opacity-70">{all.length}</span></Link>
        <Link href={href({ q, dzis: true })} className={chip(dzis)}>
          Do kontaktu dziś <span className={dzis ? "opacity-80" : dueCount ? "font-bold text-red-700" : "opacity-70"}>{dueCount}</span>
        </Link>
        {CRM_STAGES.map((s) => (
          <Link key={s} href={href({ etap: s, q })} className={chip(etap === s)}>
            {CRM_STAGE_LABELS[s]} <span className="opacity-70">{counts[s]}</span>
          </Link>
        ))}
      </nav>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Kursantka</th>
              <th className="px-4 py-3 font-semibold">Kontakt</th>
              <th className="px-4 py-3 font-semibold">Szkolenie</th>
              <th className="px-4 py-3 font-semibold">Etap</th>
              <th className="px-4 py-3 font-semibold">Następny kontakt</th>
              <th className="px-4 py-3 font-semibold"><span className="sr-only">Karta</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.assignmentId} className="align-top hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/panel/leady/${r.assignmentId}`} className="font-medium text-ink-soft hover:underline">{r.name}</Link>
                  <div className="text-xs text-muted">Przydzielona {formatDateTime(r.createdAt)}</div>
                </td>
                <td className="px-4 py-3">
                  {r.anonymized ? (
                    <span className="text-xs italic text-muted">zanonimizowano (RODO)</span>
                  ) : (
                    <div className="space-y-1">
                      <div><a href={`tel:${r.phone}`} className="font-medium text-sand-700 hover:underline">{r.phone}</a></div>
                      <div><a href={`mailto:${r.email}`} className="text-sand-700 hover:underline">{r.email}</a></div>
                      {/* Zgłoszenia sprzed rozdzielenia zgód nie mają odrębnej zgody na telefon i SMS (art. 398 Prawa komunikacji elektronicznej). */}
                      {!r.phoneConsent && (
                        <div className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                          Brak zgody na telefon i SMS. Kontakt tylko e-mailem.
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div>{r.category}</div>
                  <div className="text-xs text-muted">{r.city ? `${r.city}, ` : ""}{voivodeshipName(r.voivodeship)}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CRM_STAGE_COLORS[r.stage]}`}>{CRM_STAGE_LABELS[r.stage]}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.nextContactAt ? (
                    <span className={r.due ? "font-semibold text-red-700" : "text-ink-soft"}>
                      {formatDate(r.nextContactAt)}{r.due ? " (dziś lub zaległe)" : ""}
                    </span>
                  ) : (
                    <span className="text-muted">Nie ustawiono</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/panel/leady/${r.assignmentId}`} className="btn-outline !px-4 !py-1.5 !text-sm">Otwórz kartę</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  {all.length === 0
                    ? "Nie masz jeszcze przydzielonych kursantek. Damy znać mailowo, gdy pojawi się kandydatka."
                    : "Żadna kursantka nie pasuje do wybranych filtrów."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
