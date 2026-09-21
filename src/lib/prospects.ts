import "server-only";
import { getDb, schema } from "@/db";
import { slugify } from "./utils";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, notInArray, or, sql } from "drizzle-orm";

type ProspectValues = Partial<typeof schema.prospects.$inferInsert>;

// ===== STREFA CZASOWA (Europe/Warsaw) =====
//
// Kontener na Coolify stoi w UTC, a „dziś" w CRM ma znaczyć „dziś dla Bartka w Warszawie".
// Poniższe funkcje to JEDYNE miejsce w kodzie, które liczy się ze strefą — wszystko inne
// (kolejka do zadzwonienia, szybkie akcje, formularz następnego ruchu) korzysta z nich,
// zamiast liczyć czas samemu.
//
// Metoda (celowo NIE przez `Date.toLocaleString` + reparse — ta sztuczka zależy od strefy
// czasowej PROCESU node'a, a proces na Coolify i na tym Macu mogą się różnić; zmierzone
// empirycznie 21.09.2026, patrz cztery asercje w komentarzu przy `warsawWallTimeToUtc`):
// 1) `Intl.DateTimeFormat(..., { timeZoneName: "longOffset" })` daje przesunięcie Warszawy
//    (np. "GMT+02:00") DLA KONKRETNEGO INSTANTU — uwzględnia czas letni/zimowy automatycznie.
// 2) Dodawanie dni robimy na SAMEJ DACIE (rok-miesiąc-dzień), nie na już przeliczonym
//    instancie UTC — inaczej dodanie np. 7 dni w okolicy zmiany czasu naliczyłoby przesunięcie
//    strefy podwójnie i zegar „ześlizgnąłby się" o godzinę.

const WARSAW_TZ = "Europe/Warsaw";

function warsawDateParts(at: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Przesunięcie Warszawy względem UTC (w minutach, dodatnie na wschód) DLA DANEGO INSTANTU. */
function warsawOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: WARSAW_TZ, timeZoneName: "longOffset" }).formatToParts(
    at
  );
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(raw);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Zamienia „ścienny" czas Warszawy (rok-miesiąc-dzień godzina:minuta) na instant UTC.
 *
 * Zweryfikowane empirycznie 21.09.2026 (node, cztery asercje, bez bazy):
 *  - `warsawWallTimeToUtc(2026,7,16,9,0)`  → `2026-07-16T07:00:00.000Z` (CEST, +02)
 *  - `warsawWallTimeToUtc(2026,1,16,9,0)`  → `2026-01-16T08:00:00.000Z` (CET, +01)
 *  - koniec dnia 2026-07-15 w Warszawie    → `2026-07-15T21:59:59.999Z`
 *  - dodanie 7 dni od 2026-10-24 (przez zmianę czasu 25.10) → `2026-10-31T08:00:00.000Z`,
 *    czyli nadal 9:00 CZASU WARSZAWSKIEGO, nie 10:00 — to jest test na podwójne naliczenie DST.
 */
function warsawWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMin = warsawOffsetMinutes(guess);
  return new Date(guess.getTime() - offsetMin * 60_000);
}

/** Koniec dzisiejszego dnia (23:59:59.999) wg czasu Europe/Warsaw — próg dla „zaległe / na dziś". */
export function endOfTodayWarsaw(at: Date = new Date()): Date {
  const { year, month, day } = warsawDateParts(at);
  const end = warsawWallTimeToUtc(year, month, day, 23, 59);
  return new Date(end.getTime() + 59_999);
}

/** `at` + `days` dni kalendarzowych Warszawy, o godzinie `hour:minute` czasu Warszawy. */
export function addWarsawDays(days: number, hour: number, minute = 0, at: Date = new Date()): Date {
  const { year, month, day } = warsawDateParts(at);
  const dateOnly = new Date(Date.UTC(year, month - 1, day));
  dateOnly.setUTCDate(dateOnly.getUTCDate() + days);
  return warsawWallTimeToUtc(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth() + 1, dateOnly.getUTCDate(), hour, minute);
}

/** Zamienia datę z inputu `type="date"` (`"RRRR-MM-DD"`) na 9:00 tego dnia czasu Warszawy. */
export function warsawDateStringTo9am(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  return warsawWallTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 9, 0);
}

/** Różnica w pełnych dniach kalendarzowych Warszawy między `from` a `to` (dodatnia = `from` w przeszłości). */
export function warsawCalendarDaysDiff(from: Date, to: Date = new Date()): number {
  const a = warsawDateParts(from);
  const b = warsawDateParts(to);
  const aUtc = Date.UTC(a.year, a.month - 1, a.day);
  const bUtc = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bUtc - aUtc) / 86_400_000);
}

// ===== WARTOŚCI Z FORMULARZA → BAZA =====

/**
 * Zamienia payload z formularza na wartości do bazy: puste stringi → null,
 * żeby w CRM nie siedziały „puste, ale niepuste" pola (`''`), które psują filtry i eksport.
 * Pomija klucze, których w payloadzie nie było — dzięki temu ta sama funkcja obsługuje POST i PATCH.
 */
export function prospectValuesFromPayload(d: Record<string, unknown>): ProspectValues {
  const out: ProspectValues = {};
  const text = (key: keyof ProspectValues, value: unknown) => {
    if (value === undefined) return;
    const s = typeof value === "string" ? value.trim() : value;
    // @ts-expect-error — klucze tekstowe schematu przyjmują string | null
    out[key] = s === "" || s === null ? null : s;
  };

  if (typeof d.name === "string") out.name = d.name.trim();
  text("legalName", d.legalName);
  text("nip", d.nip);
  text("krs", d.krs);
  text("city", d.city);
  text("voivodeship", d.voivodeship);
  text("phone", d.phone);
  text("email", d.email);
  text("website", d.website);
  text("instagram", d.instagram);
  text("facebook", d.facebook);
  text("burProviderId", d.burProviderId);
  text("burUrl", d.burUrl);
  text("dossierPath", d.dossierPath);
  text("researchNotes", d.researchNotes);
  text("nextActionNote", d.nextActionNote);

  if (Array.isArray(d.categories)) out.categories = d.categories as string[];
  if (typeof d.status === "string") out.status = d.status as typeof schema.prospects.$inferInsert.status;
  if (typeof d.priority === "string") out.priority = d.priority as typeof schema.prospects.$inferInsert.priority;
  if (typeof d.source === "string") out.source = d.source;
  if (typeof d.burSegment === "string") out.burSegment = d.burSegment as typeof schema.prospects.$inferInsert.burSegment;

  for (const key of ["burServicesCompleted", "burServicesActive", "burRatingX10", "burReviewCount"] as const) {
    if (key in d) out[key] = (d[key] as number | null) ?? null;
  }

  // `nextActionAt` przychodzi z formularza jako "RRRR-MM-DD" (input type="date") albo "" (wyczyść).
  // Konwersja na 9:00 czasu Warszawy dzieje się TU, nie w komponencie klienta — inaczej data
  // wpisana przez Bartka o północy dostałaby przesunięcie strefy jego przeglądarki, nie serwera.
  if ("nextActionAt" in d) {
    const raw = d.nextActionAt;
    out.nextActionAt = typeof raw === "string" && raw !== "" ? warsawDateStringTo9am(raw) : null;
  }

  return out;
}

/**
 * Typy aktywności, które liczą się jako REALNY kontakt i aktualizują `prospects.lastContactAt`.
 * Notatka i automatyczny wpis o zmianie statusu NIE są kontaktem — nie mówią, że ktoś faktycznie
 * rozmawiał z akademią, tylko że coś się zmieniło w danych.
 */
export const PROSPECT_CONTACT_ACTIVITY_TYPES: ReadonlySet<string> = new Set(["telefon", "email", "spotkanie"]);

/** Wpis na oś czasu prospekta. Nie rzuca w górę — historia kontaktu nie może wywrócić zapisu. */
export async function logProspectActivity(params: {
  prospectId: number;
  type: typeof schema.prospectActivities.$inferInsert.type;
  content: string;
  createdBy?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(schema.prospectActivities).values({
      prospectId: params.prospectId,
      type: params.type,
      content: params.content,
      createdBy: params.createdBy ?? "admin",
    });
  } catch (err) {
    console.error("[prospects] Nie udało się zapisać aktywności:", err);
  }
}

// ===== KOLEJKA „DO ZADZWONIENIA" =====
//
// Wspólna dla bloku na górze `/admin/crm-trenerki` i dla filtra `?widok=dzis` w tabeli głównej —
// logika mieszka TU, żeby nie rozjechać się w dwóch miejscach.

/** Statusy „martwe" — nawet zaległy termin nie wraca ich na listę telefonów. */
const CALL_QUEUE_EXCLUDED_STATUSES = ["odrzucony", "parking"] as const satisfies readonly (typeof schema.prospects.$inferSelect.status)[];

/** Bez ustalonego terminu, ale rozmowa już zaczęta i zawieszona — to też trzeba dociągnąć. */
const CALL_QUEUE_STALLED_STATUSES = ["do_kontaktu", "kontakt", "rozmowa"] as const satisfies readonly (typeof schema.prospects.$inferSelect.status)[];

/**
 * Warunek „trzeba do niej zadzwonić dziś": zaległy/dzisiejszy termin ALBO rozmowa zaczęta
 * i porzucona bez ustalonego następnego kroku, z pominięciem statusów martwych.
 */
export function callQueueCondition(now: Date = new Date()) {
  const cutoff = endOfTodayWarsaw(now);
  return and(
    notInArray(schema.prospects.status, [...CALL_QUEUE_EXCLUDED_STATUSES]),
    or(
      and(isNotNull(schema.prospects.nextActionAt), lte(schema.prospects.nextActionAt, cutoff)),
      and(isNull(schema.prospects.nextActionAt), inArray(schema.prospects.status, [...CALL_QUEUE_STALLED_STATUSES]))
    )
  )!;
}

/** wysoki→niski, do sortowania kolejki (drizzle nie zna kolejności enuma tekstowego). */
const CALL_QUEUE_PRIORITY_RANK = sql<number>`case ${schema.prospects.priority} when 'wysoki' then 0 when 'sredni' then 1 else 2 end`;

export type ProspectRow = typeof schema.prospects.$inferSelect;

/**
 * Kolejka „kogo dzwonisz dziś": zaległe i dzisiejsze terminy najpierw (`nextActionAt` rosnąco,
 * NULL-e na końcu z natury sortowania ASC w Postgresie), potem priorytet, potem najwięcej usług w BUR.
 */
export async function getCallQueue(limit = 25): Promise<{ rows: ProspectRow[]; total: number }> {
  const db = await getDb();
  const where = callQueueCondition();
  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(schema.prospects)
      .where(where)
      .orderBy(asc(schema.prospects.nextActionAt), asc(CALL_QUEUE_PRIORITY_RANK), desc(schema.prospects.burServicesCompleted))
      .limit(limit),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.prospects).where(where),
  ]);
  return { rows, total: totalRows[0]?.c ?? 0 };
}

/**
 * Wolny slug dla profilu w katalogu publicznym. `trainers.slug` jest UNIQUE,
 * a nazwy akademii bywają zbieżne — dokładamy sufiks zamiast wywalać zapis błędem 409.
 */
export async function freeTrainerSlug(name: string): Promise<string> {
  const db = await getDb();
  const base = slugify(name).slice(0, 150) || "trenerka";
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const taken = await db
      .select({ id: schema.trainers.id })
      .from(schema.trainers)
      .where(eq(schema.trainers.slug, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}
