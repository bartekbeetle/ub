import Link from "next/link";
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Lead, QuizSession, Submission } from "@/db/schema";
import { LejekKursantek, type EtapLejka } from "@/components/admin/LejekKursantek";
import { RevealContact } from "@/components/admin/RevealContact";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { SubmissionToggle } from "@/components/admin/SubmissionToggle";
import { DeleteRecordButton } from "@/components/admin/DeleteRecordButton";
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
 *
 * 18.09.2026: wchłonięty ekran „Porzucone quizy". Porzucone aplikacje to trzeci typ wiersza
 * w tej samej tabeli, a nad nią stoi LEJEK spinający całość — od pierwszego kroku formularza
 * po rozliczenie. Powód: to jest jedna droga jednej kobiety i oglądanie jej w dwóch
 * zakładkach ukrywało miejsce, w którym ucieka pieniądz.
 *
 * ⚠️ Liczby w lejku dotyczą CAŁEJ BAZY, a tabela pod nim jest przefiltrowana i ucięta
 * do 300 wierszy. To jest celowe: lejek ma pokazywać stan firmy, tabela — robotę do zrobienia.
 */

const MAX_ROWS = 300;

type Row =
  | { kind: "lead"; id: number; createdAt: Date; lead: Lead }
  | { kind: "submission"; id: number; createdAt: Date; submission: Submission }
  | { kind: "porzucona"; id: number; createdAt: Date; sesja: QuizSession };

/** Stawka modelu pay-per-result: 500 zł naliczane przy statusie „zapisana". */
const STAWKA_ZA_ZAPIS = 500;

/** Kroki aplikacji — etykiety muszą odpowiadać krokom w `src/components/Quiz.tsx`. */
const KROKI_APLIKACJI = [
  "Imię, e-mail, zgoda",
  "Szkolenie i region",
  "Sytuacja zawodowa",
  "Cel",
  "Wiek i dojazd",
  "Telefon",
  "Złożenie aplikacji",
];

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

  /**
   * `?etap=` — skrót z lejka. Nie duplikuje filtrów, tylko je ustawia: jedno kliknięcie
   * w pasek ma pokazać dokładnie te kobiety, które w nim siedzą.
   */
  const etap = str("etap");
  const krokPorzucenia = etap.startsWith("krok-") ? Number(etap.slice(5)) : 0;
  const pokazPorzucone = etap === "porzucone" || krokPorzucenia > 0;
  const etapStatus = (LEAD_STATUSES as readonly string[]).includes(etap) ? etap : "";
  const etapBezPrzydzialu = etap === "bez-przydzialu";
  const etapZlozone = etap === "zlozone";
  const etapInneWejscia = etap === "inne-wejscia";
  const etapZgloszenia = etap === "zgloszenia";

  const statusEfektywny = etapStatus || status;
  const przydzialEfektywny = etapBezPrzydzialu ? "brak" : przydzial;

  // Filtry, których zgłoszenie nie jest w stanie spełnić — bo nie ma tych danych.
  const leadOnlyFilter = Boolean(statusEfektywny || woj || kategoria || przydzialEfektywny || leadSource);
  const pobierzLeady =
    typ !== "zgloszenie" && !submissionType && !pokazPorzucone && !etapZgloszenia;
  const pobierzZgloszenia =
    typ !== "lead" && !leadOnlyFilter && !pokazPorzucone && !etapZlozone && !etapInneWejscia;

  const db = await getDb();

  // --- LEADY ---
  const leadConditions: SQL[] = [];
  if (statusEfektywny)
    leadConditions.push(eq(schema.leads.status, statusEfektywny as (typeof LEAD_STATUSES)[number]));
  if (stan === "do_zrobienia") leadConditions.push(inArray(schema.leads.status, [...LEAD_STATUSES_OPEN]));
  if (stan === "obsluzone") leadConditions.push(inArray(schema.leads.status, [...LEAD_STATUSES_CLOSED]));
  if (leadSource) leadConditions.push(eq(schema.leads.source, leadSource as (typeof LEAD_SOURCES)[number]));
  // Wejście 1 = aplikacja (źródło `quiz`), wejście 2 = cała reszta formularzy.
  if (etapZlozone) leadConditions.push(eq(schema.leads.source, "quiz"));
  if (etapInneWejscia) leadConditions.push(sql`${schema.leads.source} <> 'quiz'`);
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

  const porzuconeConditions: SQL[] = [
    eq(schema.quizSessions.completed, false),
    ...(krokPorzucenia > 0 ? [eq(schema.quizSessions.maxStepReached, krokPorzucenia)] : []),
    ...(q
      ? [
          or(
            ilike(schema.quizSessions.name, `%${q}%`),
            ilike(schema.quizSessions.email, `%${q}%`)
          )!,
        ]
      : []),
  ];

  const [leadRows, submissionRows, assignments, converted, liczniki, porzuconeRows, lejek] =
    await Promise.all([
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
    pokazPorzucone
      ? db
          .select()
          .from(schema.quizSessions)
          .where(and(...porzuconeConditions))
          .orderBy(desc(schema.quizSessions.updatedAt))
          .limit(MAX_ROWS)
      : Promise.resolve([] as QuizSession[]),
    policzLejek(db),
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
    if (przydzialEfektywny === "brak") return !assignedBy.has(l.id);
    if (przydzialEfektywny === "jest") return assignedBy.has(l.id);
    return true;
  });

  const rows: Row[] = [
    ...leadyPoPrzydziale.map((l): Row => ({ kind: "lead", id: l.id, createdAt: l.createdAt, lead: l })),
    ...submissionRows.map((s): Row => ({ kind: "submission", id: s.id, createdAt: s.createdAt, submission: s })),
    // Tylko sesje NIEDOKOŃCZONE (warunek w zapytaniu) — dokończona ma już swojego leada
    // w wierszach wyżej i wpadłaby na listę drugi raz jako ta sama kobieta.
    ...porzuconeRows.map((s): Row => ({ kind: "porzucona", id: s.id, createdAt: s.updatedAt, sesja: s })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_ROWS);

  const liczbaLeadow = rows.filter((r) => r.kind === "lead").length;
  const liczbaZgloszen = rows.filter((r) => r.kind === "submission").length;
  const liczbaPorzuconych = rows.filter((r) => r.kind === "porzucona").length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Kursantki</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Cała droga kursantki w jednym miejscu: porzucone aplikacje, zgłoszenia i leady.
            Lejek liczy <strong className="text-ink-soft">rekordy</strong>, nie osoby — jedna kobieta,
            która wysłała formularz dwa razy, jest tu dwa razy.
          </p>
        </div>
        <a href="/api/admin/leads/export" className="btn-outline !px-4 !py-2 !text-sm">Eksport leadów CSV</a>
      </div>

      {/* LEJEK — zastąpił trzy kafelki i osobną zakładkę „Porzucone quizy" */}
      <div className="mt-6">
        <LejekKursantek
          aplikacja={lejek.aplikacja}
          inneWejscia={lejek.inneWejscia}
          wspolny={lejek.wspolny}
          naStole={lejek.naStole}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Szybko:</span>
        <Link href="/admin/kursantki?stan=do_zrobienia" className="rounded-full border px-3 py-1 hover:bg-sand-50">
          Do obsłużenia <strong>{liczniki.doObsluzenia}</strong>
        </Link>
        <Link href="/admin/kursantki?etap=porzucone" className="rounded-full border px-3 py-1 hover:bg-sand-50">
          Porzucone aplikacje <strong>{lejek.porzuconeRazem}</strong>
        </Link>
        <Link
          href="/admin/kursantki?etap=porzucone"
          className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-emerald-900 hover:bg-emerald-100"
        >
          Wolno napisać maila <strong>{lejek.zgodyPorzuconych}</strong>
        </Link>
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
        <strong className="text-ink-soft">{liczbaZgloszen}</strong> zgłoszeń ·{" "}
        <strong className="text-ink-soft">{liczbaPorzuconych}</strong> porzuconych aplikacji
        {rows.length === MAX_ROWS ? " (limit 300 — zawęź filtry)" : ""}
      </p>

      {liczbaPorzuconych > 0 && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          🔴 Przy porzuconych aplikacjach kolumna „Można pisać?" nie jest podpowiedzią, tylko granicą
          prawną. <strong>Zgoda na kontakt</strong> pozwala wyłącznie przypomnieć o dokończeniu TEJ
          aplikacji; oferty i nabory wymagają osobnej <strong>zgody marketingowej</strong>. Wysyłka do
          rekordów bez podstawy to marketing bez zgody (art. 398 Prawa komunikacji elektronicznej) —
          kara do 3% przychodu albo 1 mln zł, plus odpowiedzialność osobista. UOKiK 24.07.2026 ukarał
          za to spółkę na 308 728 zł, a prezesa na 100 000 zł. Tych osób nie odzyskujemy mailem, tylko
          remarketingiem przez piksel.
        </p>
      )}

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
              ) : row.kind === "submission" ? (
                <WierszZgloszenia key={`z-${row.id}`} submission={row.submission} />
              ) : (
                <WierszPorzuconej key={`p-${row.id}`} sesja={row.sesja} />
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



/**
 * Wiersz PORZUCONEJ APLIKACJI — kobieta zaczęła wypełniać i przerwała.
 * Kolumny celowo pokrywają się z leadem (data, kontakt, kwalifikacja), żeby jedna tabela
 * dała się czytać w pionie. W miejsce statusu wchodzi krok, na którym odpadła,
 * a w miejsce przydziału — podstawa prawna kontaktu.
 */
function WierszPorzuconej({ sesja }: { sesja: QuizSession }) {
  const krok = KROKI_APLIKACJI[sesja.maxStepReached - 1] ?? `krok ${sesja.maxStepReached}`;
  const mozeMail = Boolean(sesja.contactConsentAt && sesja.email);

  return (
    <tr className="align-top bg-red-50/20 hover:bg-red-50/40">
      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(sesja.updatedAt)}</td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
          Porzucona
        </span>
      </td>
      <td className="px-4 py-3 font-medium">
        {sesja.name || <span className="text-muted">— (nie zdążyła podać)</span>}
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          {sesja.email ? (
            <div><RevealContact masked={maskEmail(sesja.email)} full={sesja.email} /></div>
          ) : (
            <div className="text-xs italic text-muted">brak e-maila</div>
          )}
          {sesja.phone && (
            <div><RevealContact masked={maskPhone(sesja.phone)} full={sesja.phone} /></div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted">Aplikacja</td>
      <td className="px-4 py-3">
        {sesja.category ? (
          <>
            <span className="block">{sesja.category}</span>
            <span className="block text-xs text-muted">
              {sesja.voivodeship ? voivodeshipName(sesja.voivodeship) : ""}
              {sesja.city ? `, ${sesja.city}` : ""}
            </span>
          </>
        ) : (
          <span className="text-xs italic text-muted">nie doszła do tego pytania</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        <span className="text-muted">przerwała na:</span>
        <span className="block font-medium">{`${sesja.maxStepReached}. ${krok}`}</span>
      </td>
      <td className="px-4 py-3 text-xs">
        {mozeMail ? (
          <div className="space-y-1">
            <span className="block w-fit rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
              przypomnienie o aplikacji
            </span>
            {sesja.marketingConsentAt && (
              <span className="block w-fit rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                + oferty i nabory
              </span>
            )}
          </div>
        ) : sesja.marketingConsentAt && sesja.email ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">tylko oferty</span>
        ) : (
          <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">nie pisać</span>
        )}
      </td>
    </tr>
  );
}

/* ===== LEJEK ===== */

/**
 * Wszystko liczone agregatami po stronie bazy, nie filtrowaniem tablicy w JS.
 * Ekran jest `force-dynamic`, więc każde wejście to realne zapytania — a po pracy
 * wydajnościowej z 18.09 nie wracamy do mielenia setek wierszy w pamięci.
 */
async function policzLejek(db: Awaited<ReturnType<typeof getDb>>) {
  const [wgKroku, wgStatusu, przydzielone, wgZrodla, zgloszenia, zgodyPorzuconych] =
    await Promise.all([
      db
        .select({
          krok: schema.quizSessions.maxStepReached,
          dokonczone: schema.quizSessions.completed,
          c: sql<number>`count(*)::int`,
        })
        .from(schema.quizSessions)
        .groupBy(schema.quizSessions.maxStepReached, schema.quizSessions.completed),
      db
        .select({
          status: schema.leads.status,
          c: sql<number>`count(*)::int`,
        })
        .from(schema.leads)
        .groupBy(schema.leads.status),
      db
        .select({ c: sql<number>`count(distinct ${schema.leadAssignments.leadId})::int` })
        .from(schema.leadAssignments),
      db
        .select({ zrodlo: schema.leads.source, c: sql<number>`count(*)::int` })
        .from(schema.leads)
        .groupBy(schema.leads.source),
      db.select({ c: sql<number>`count(*)::int` }).from(schema.submissions),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(schema.quizSessions)
        .where(
          and(
            eq(schema.quizSessions.completed, false),
            isNotNull(schema.quizSessions.contactConsentAt)
          )
        ),
    ]);

  const statusy = new Map(wgStatusu.map((r) => [r.status as string, r.c]));
  const ile = (...s: string[]) => s.reduce((sum, k) => sum + (statusy.get(k) ?? 0), 0);

  const leadyRazem = wgStatusu.reduce((sum, r) => sum + r.c, 0);
  const leadyZAplikacji = wgZrodla.find((r) => r.zrodlo === "quiz")?.c ?? 0;
  const leadyZInnych = leadyRazem - leadyZAplikacji;
  const zPrzydzialem = przydzielone[0]?.c ?? 0;

  // --- WEJŚCIE 1: aplikacja, krok po kroku ---
  const sesjeRazem = wgKroku.reduce((sum, r) => sum + r.c, 0);
  const doszloDoKroku = (k: number) =>
    wgKroku.filter((r) => r.krok >= k).reduce((sum, r) => sum + r.c, 0);
  const porzuconeNaKroku = (k: number) =>
    wgKroku.filter((r) => r.krok === k && !r.dokonczone).reduce((sum, r) => sum + r.c, 0);

  const aplikacja: EtapLejka[] = KROKI_APLIKACJI.map((etykieta, i) => {
    const krok = i + 1;
    const doszlo = doszloDoKroku(krok);
    const odpadlo = porzuconeNaKroku(krok);
    return {
      klucz: `krok-${krok}`,
      etykieta: `${krok}. ${etykieta}`,
      liczba: doszlo,
      procent: sesjeRazem ? Math.round((doszlo / sesjeRazem) * 100) : 0,
      ubytek: odpadlo,
      // Największy wyciek zaznaczamy na czerwono dopiero przy realnej skali,
      // żeby przy trzech sesjach nie malować alarmu z jednej osoby.
      alarm: odpadlo >= 3,
    };
  });

  // --- WEJŚCIE 2: konsultacja / kontakt ---
  const inneWejscia: EtapLejka[] = [
    {
      klucz: "inne-wejscia",
      etykieta: "Leady z konsultacji i kontaktu",
      liczba: leadyZInnych,
      procent: 100,
      opis: "formularz konsultacji, karta kursu, landing, recepcjonistka",
    },
    {
      klucz: "zgloszenia",
      etykieta: "Zgłoszenia bez kwalifikacji",
      liczba: zgloszenia[0]?.c ?? 0,
      procent: leadyZInnych ? Math.round(((zgloszenia[0]?.c ?? 0) / leadyZInnych) * 100) : 0,
      opis: "brak województwa i kategorii — warte 0 zł, dopóki ich nie uzupełnisz",
      alarm: (zgloszenia[0]?.c ?? 0) > 0,
    },
  ];

  // --- WSPÓLNA DROGA ---
  const zapisane = ile("zapisana", "rozliczony");
  const rozliczone = ile("rozliczony");
  const skontaktowane = ile("skontaktowany", "zapisana", "rozliczony");
  const bezPrzydzialu = leadyRazem - zPrzydzialem;

  const pct = (n: number) => (leadyRazem ? Math.round((n / leadyRazem) * 100) : 0);

  const wspolny: EtapLejka[] = [
    {
      klucz: "lead",
      etykieta: "Lead — komplet danych",
      liczba: leadyRazem,
      procent: 100,
      opis: `${leadyZAplikacji} z aplikacji · ${leadyZInnych} z pozostałych wejść`,
    },
    {
      klucz: "bez-przydzialu",
      etykieta: "Przydzielona trenerce",
      liczba: zPrzydzialem,
      procent: pct(zPrzydzialem),
      ubytek: bezPrzydzialu,
      alarm: bezPrzydzialu > 0,
      opis: bezPrzydzialu > 0 ? `${bezPrzydzialu} czeka bez adresata` : undefined,
    },
    {
      klucz: "skontaktowany",
      etykieta: "Skontaktowana",
      liczba: skontaktowane,
      procent: pct(skontaktowane),
      ubytek: zPrzydzialem - skontaktowane,
    },
    {
      klucz: "zapisana",
      etykieta: "Zapisana na szkolenie",
      liczba: zapisane,
      procent: pct(zapisane),
      kwota: zapisane * STAWKA_ZA_ZAPIS,
      opis: "tu powstaje należność 500 zł",
    },
    {
      klucz: "rozliczony",
      etykieta: "Rozliczona",
      liczba: rozliczone,
      procent: pct(rozliczone),
      kwota: rozliczone * STAWKA_ZA_ZAPIS,
      opis: "pieniądze na koncie",
    },
  ];

  return {
    aplikacja,
    inneWejscia,
    wspolny,
    naStole: { leadow: bezPrzydzialu, kwota: bezPrzydzialu * STAWKA_ZA_ZAPIS },
    zgodyPorzuconych: zgodyPorzuconych[0]?.c ?? 0,
    porzuconeRazem: sesjeRazem - doszloDoKroku(7),
  };
}

/* ===== LICZNIKI ===== */

async function liczLiczniki(db: Awaited<ReturnType<typeof getDb>>) {
  const [openLeads, unhandledSubs, neverQualified] = await Promise.all([
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
      .where(isNull(schema.submissions.convertedToLeadId)),
  ]);

  return {
    doObsluzenia: (openLeads[0]?.c ?? 0) + (unhandledSubs[0]?.c ?? 0),
    zgloszeniaBezKwalifikacji: neverQualified[0]?.c ?? 0,
  };
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
        <DeleteRecordButton id={lead.id} kind="lead" name={lead.name} />
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
        <DeleteRecordButton id={submission.id} kind="zgloszenie" name={submission.name} />
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
