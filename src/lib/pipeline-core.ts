/**
 * RDZEŃ CRM ADMINA (`/admin/crm-kursantki`) — bez `server-only` i bez singletona bazy,
 * żeby dało się go przetestować na PGlite (`npm run test:pipeline`). W aplikacji wołaj `@/lib/pipeline`.
 *
 * Ciąg pracy (Bartek, 08.10.2026):
 *  1. „Dodaj trenerkę" → rekord trenerki + tablica na KAŻDĄ jej kategorię (trenerka × kategoria).
 *  2. Lejek: kursantki bez przydziału, Bartek kwalifikuje po telefonie.
 *  3. Przypisanie z lejka na tablicę → karta wpada w kolumnę „Przypisana".
 *  4. Karta przechodzi cykl sprzedaży; „Wpłaciła" nalicza należność przez WSPÓLNY rdzeń rozliczeń.
 *
 * 🔴 ZERO WYSYŁKI z tego modułu:
 *  - przypisanie NIE wysyła trenerce danych kursantki (decyzja: dane idą dopiero po umowie),
 *  - naliczenie woła rdzeń z `onSigned` = no-op, więc nie idą maile do kursantki ani do biura.
 *  Test `test:pipeline` pilnuje, że żadna z tych ścieżek nie dokłada nic do `email_queue`.
 */
import { and, asc, desc, eq, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/admin-audit-core";
import { CATEGORIES } from "@/lib/constants";
import {
  changeAssignmentStatusCore,
  type AuditFn,
  type StatusActor,
} from "@/lib/assignment-status-core";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_TO_STATUS,
  defaultBoardName,
  pipelineStageOf,
  type FunnelStage,
  type PipelineStage,
} from "@/lib/pipeline-stages";

export type Fail = { ok: false; status: number; error: string };
export type Res<T> = ({ ok: true } & T) | Fail;
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

/** Twardy limit z istniejącej trasy przydziału: jedna kursantka maks. u 3 trenerek. */
export const MAX_ASSIGNMENTS_PER_LEAD = 3;

export function isCategory(v: string): boolean {
  return (CATEGORIES as readonly string[]).includes(v);
}

function slugBase(text: string): string {
  const map: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
  return (
    text
      .toLowerCase()
      .split("")
      .map((c) => map[c] ?? c)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140) || "trenerka"
  );
}

// ===== TABLICE =====

export type BoardSummary = {
  id: number;
  name: string;
  category: string;
  trainerId: number;
  trainerName: string;
  /** Czy trenerka ma podpisaną umowę (bramka `autoAssign`) — tylko do podpisu na zakładce. */
  hasContract: boolean;
  cards: number;
};

export async function listBoards(db: AnyDb): Promise<BoardSummary[]> {
  const boards = await db
    .select({ board: schema.crmBoards, trainer: schema.trainers })
    .from(schema.crmBoards)
    .innerJoin(schema.trainers, eq(schema.crmBoards.trainerId, schema.trainers.id))
    .where(eq(schema.crmBoards.isArchived, false))
    .orderBy(asc(schema.trainers.name), asc(schema.crmBoards.category));
  const out: BoardSummary[] = [];
  for (const { board, trainer } of boards) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.leadAssignments)
      .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
      .where(boardCardsCondition(board));
    out.push({
      id: board.id,
      name: board.name,
      category: board.category,
      trainerId: trainer.id,
      trainerName: trainer.name,
      hasContract: trainer.autoAssign,
      cards: n,
    });
  }
  return out;
}

/**
 * Karty tablicy: przydziały dopięte do niej (`board_id`) ORAZ starsze przydziały tej trenerki
 * bez tablicy, których kursantka ma tę samą kategorię — inaczej przydziały sprzed tablic znikłyby z widoku.
 */
function boardCardsCondition(board: schema.CrmBoard) {
  return or(
    eq(schema.leadAssignments.boardId, board.id),
    and(
      isNull(schema.leadAssignments.boardId),
      eq(schema.leadAssignments.trainerId, board.trainerId),
      eq(schema.leads.category, board.category)
    )
  )!;
}

/** Tablica trenerka × kategoria; tworzy ją, gdy jej nie ma (idempotentne dzięki unikalnemu indeksowi). */
export async function ensureBoard(db: AnyDb, trainerId: number, category: string): Promise<schema.CrmBoard> {
  const [existing] = await db
    .select()
    .from(schema.crmBoards)
    .where(and(eq(schema.crmBoards.trainerId, trainerId), eq(schema.crmBoards.category, category)))
    .limit(1);
  if (existing) {
    if (existing.isArchived) {
      const [revived] = await db
        .update(schema.crmBoards)
        .set({ isArchived: false })
        .where(eq(schema.crmBoards.id, existing.id))
        .returning();
      return revived;
    }
    return existing;
  }
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, trainerId)).limit(1);
  await db
    .insert(schema.crmBoards)
    .values({ trainerId, category, name: defaultBoardName(trainer?.name ?? "Trenerka", category) })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(schema.crmBoards)
    .where(and(eq(schema.crmBoards.trainerId, trainerId), eq(schema.crmBoards.category, category)))
    .limit(1);
  return row;
}

export type NewTrainerInput = {
  name: string;
  categories: string[];
  city?: string | null;
  phone?: string | null;
  email?: string | null;
};

/**
 * „Dodaj trenerkę" z CRM-u. Trenerka powstaje BEZ umowy (`autoAssign = false`), więc automat
 * nie wyda jej żadnych danych; konto logowania nie powstaje (dane kursantek widzi tylko Bartek).
 */
export async function createTrainerWithBoards(
  db: AnyDb,
  input: NewTrainerInput,
  deps: { audit: AuditFn }
): Promise<Res<{ trainerId: number; boardIds: number[] }>> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160) return fail(400, "Podaj nazwę trenerki lub akademii (2–160 znaków).");
  const categories = [...new Set(input.categories.map((c) => c.trim()))];
  if (categories.length === 0) return fail(400, "Zaznacz przynajmniej jedną kategorię kursów.");
  if (!categories.every(isCategory)) return fail(400, "Nieznana kategoria kursów.");

  const base = slugBase(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const [taken] = await db
      .select({ id: schema.trainers.id })
      .from(schema.trainers)
      .where(eq(schema.trainers.slug, slug))
      .limit(1);
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const [trainer] = await db
    .insert(schema.trainers)
    .values({
      name,
      slug,
      specializations: categories,
      city: input.city?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      autoAssign: false,
      isActive: true,
    })
    .returning();

  const boardIds: number[] = [];
  for (const c of categories) boardIds.push((await ensureBoard(db, trainer.id, c)).id);

  await deps.audit({
    action: "trenerka_utworzona_crm",
    entityType: "trainer",
    entityId: trainer.id,
    details: { name, categories, boardIds },
  });
  return { ok: true, trainerId: trainer.id, boardIds };
}

/** Dodatkowa tablica dla istniejącej trenerki (nowa kategoria = nowa kampania). */
export async function addBoard(
  db: AnyDb,
  input: { trainerId: number; category: string },
  deps: { audit: AuditFn }
): Promise<Res<{ boardId: number }>> {
  if (!isCategory(input.category)) return fail(400, "Nieznana kategoria kursów.");
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, input.trainerId)).limit(1);
  if (!trainer) return fail(404, "Nie znaleziono trenerki.");
  const board = await ensureBoard(db, trainer.id, input.category);
  if (!trainer.specializations.includes(input.category)) {
    await db
      .update(schema.trainers)
      .set({ specializations: [...trainer.specializations, input.category] })
      .where(eq(schema.trainers.id, trainer.id));
  }
  await deps.audit({
    action: "tablica_crm_dodana",
    entityType: "trainer",
    entityId: trainer.id,
    details: { boardId: board.id, category: input.category },
  });
  return { ok: true, boardId: board.id };
}

// ===== LEJEK =====

export type FunnelCard = {
  id: number;
  name: string;
  phone: string;
  email: string;
  category: string;
  city: string | null;
  voivodeship: string;
  courseTitle: string | null;
  createdAt: Date;
  stage: FunnelStage;
  /** Brak zgody na telefon = nie dzwonimy (art. 398 PKE). */
  hasPhoneConsent: boolean;
  source: string;
};

/** Kursantki bez żadnego przydziału (i nie zanonimizowane). */
export async function listFunnel(db: AnyDb): Promise<FunnelCard[]> {
  const rows = await db
    .select({ lead: schema.leads, courseTitle: schema.courses.title })
    .from(schema.leads)
    .leftJoin(schema.courses, eq(schema.leads.courseId, schema.courses.id))
    .where(
      and(
        isNull(schema.leads.anonymizedAt),
        notExists(
          db
            .select({ one: sql`1` })
            .from(schema.leadAssignments)
            .where(eq(schema.leadAssignments.leadId, schema.leads.id))
        )
      )
    )
    .orderBy(desc(schema.leads.createdAt));
  return rows.map(({ lead, courseTitle }) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    category: lead.category,
    city: lead.city,
    voivodeship: lead.voivodeship,
    courseTitle: courseTitle ?? null,
    createdAt: lead.createdAt,
    // Lead odrzucony starym widokiem (`status`) też ląduje w kolumnie „Odrzucona".
    stage: lead.status === "odrzucony" ? "odrzucona" : (lead.qualification as FunnelStage),
    hasPhoneConsent: Boolean(lead.contactConsentAt),
    source: lead.source,
  }));
}

export async function setQualification(
  db: AnyDb,
  leadId: number,
  stage: FunnelStage,
  deps: { audit: AuditFn }
): Promise<Res<object>> {
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  if (!lead || lead.anonymizedAt) return fail(404, "Nie znaleziono kursantki.");
  const update: Partial<typeof schema.leads.$inferInsert> = { qualification: stage };
  // Spójność ze starym widokiem: odrzucona ↔ status `odrzucony`, ale tylko dla kursantki bez przydziału.
  if (stage === "odrzucona" && lead.status === "nowy") update.status = "odrzucony";
  if (stage !== "odrzucona" && lead.status === "odrzucony") update.status = "nowy";
  await db.update(schema.leads).set(update).where(eq(schema.leads.id, leadId));
  await deps.audit({
    action: "kwalifikacja_kursantki",
    entityType: "lead",
    entityId: leadId,
    details: { from: lead.qualification, to: stage },
  });
  return { ok: true };
}

/**
 * Przypisanie kursantki z lejka na tablicę. 🔴 Bez żadnego maila do trenerki — dane kursantki
 * nie wychodzą z systemu, dopóki trenerka nie podpisze umowy (decyzja Bartka 08.10.2026).
 */
export async function assignToBoard(
  db: AnyDb,
  input: { leadId: number; boardId: number; actor: string },
  deps: { audit: AuditFn }
): Promise<Res<{ assignmentId: number }>> {
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, input.leadId)).limit(1);
  if (!lead || lead.anonymizedAt) return fail(404, "Nie znaleziono kursantki.");
  const [row] = await db
    .select({ board: schema.crmBoards, trainer: schema.trainers })
    .from(schema.crmBoards)
    .innerJoin(schema.trainers, eq(schema.crmBoards.trainerId, schema.trainers.id))
    .where(eq(schema.crmBoards.id, input.boardId))
    .limit(1);
  if (!row || row.board.isArchived) return fail(404, "Nie znaleziono tablicy.");

  const all = await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.leadId, lead.id));
  if (all.some((a) => a.trainerId === row.trainer.id)) return fail(409, "Ta kursantka jest już u tej trenerki.");
  if (all.length >= MAX_ASSIGNMENTS_PER_LEAD) return fail(409, "Kursantka jest już u 3 trenerek — to twardy limit.");

  const [assignment] = await db
    .insert(schema.leadAssignments)
    .values({
      leadId: lead.id,
      trainerId: row.trainer.id,
      boardId: row.board.id,
      adminStage: "przypisana",
      assignedBy: input.actor,
      amount: row.trainer.billingModel === "per_lead" ? row.trainer.rate : 0,
    })
    .returning();

  const leadUpdate: Partial<typeof schema.leads.$inferInsert> = { qualification: "zakwalifikowana" };
  if (lead.status === "nowy" || lead.status === "odrzucony") leadUpdate.status = "przydzielony";
  await db.update(schema.leads).set(leadUpdate).where(eq(schema.leads.id, lead.id));

  await db.insert(schema.crmEvents).values({
    assignmentId: assignment.id,
    trainerId: row.trainer.id,
    kind: "etap",
    summary: `Przypisana na tablicę „${row.board.name}"`,
  });
  await deps.audit({
    action: "lead_przypisany_na_tablice",
    entityType: "lead",
    entityId: lead.id,
    details: { boardId: row.board.id, trainerId: row.trainer.id, assignmentId: assignment.id },
  });
  return { ok: true, assignmentId: assignment.id };
}

// ===== TABLICA =====

export type BoardCard = {
  assignmentId: number;
  leadId: number;
  name: string;
  phone: string;
  email: string;
  city: string | null;
  voivodeship: string;
  courseTitle: string | null;
  stage: PipelineStage;
  amount: number;
  assignedAt: Date;
  hasPhoneConsent: boolean;
  lastEvent: string | null;
};

export async function getBoard(db: AnyDb, boardId: number) {
  const [row] = await db
    .select({ board: schema.crmBoards, trainer: schema.trainers })
    .from(schema.crmBoards)
    .innerJoin(schema.trainers, eq(schema.crmBoards.trainerId, schema.trainers.id))
    .where(eq(schema.crmBoards.id, boardId))
    .limit(1);
  return row ?? null;
}

export async function listBoardCards(db: AnyDb, boardId: number): Promise<BoardCard[] | null> {
  const row = await getBoard(db, boardId);
  if (!row) return null;
  const rows = await db
    .select({ a: schema.leadAssignments, lead: schema.leads, courseTitle: schema.courses.title })
    .from(schema.leadAssignments)
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .leftJoin(schema.courses, eq(schema.leads.courseId, schema.courses.id))
    .where(boardCardsCondition(row.board))
    .orderBy(desc(schema.leadAssignments.createdAt));

  const ids = rows.map((r) => r.a.id);
  const lastByAssignment = new Map<number, string>();
  if (ids.length) {
    const events = await db
      .select()
      .from(schema.crmEvents)
      .where(inArray(schema.crmEvents.assignmentId, ids))
      .orderBy(desc(schema.crmEvents.createdAt));
    for (const e of events) if (!lastByAssignment.has(e.assignmentId)) lastByAssignment.set(e.assignmentId, e.summary);
  }

  return rows.map(({ a, lead, courseTitle }) => ({
    assignmentId: a.id,
    leadId: lead.id,
    name: lead.anonymizedAt ? "(dane usunięte)" : lead.name,
    phone: lead.anonymizedAt ? "" : lead.phone,
    email: lead.anonymizedAt ? "" : lead.email,
    city: lead.city,
    voivodeship: lead.voivodeship,
    courseTitle: courseTitle ?? null,
    stage: pipelineStageOf(a.status, a.adminStage),
    amount: a.amount,
    assignedAt: a.createdAt,
    hasPhoneConsent: Boolean(lead.contactConsentAt),
    lastEvent: lastByAssignment.get(a.id) ?? null,
  }));
}

/**
 * Przesunięcie karty. Gdy etap wymaga innego statusu przydziału, idziemy przez WSPÓLNY rdzeń
 * rozliczeń (`changeAssignmentStatusCore`, zakres admina) — naliczenie, eskalacja statusu leada,
 * blokada cofnięcia zapisu (tylko superadmin) i audyt działają identycznie jak wszędzie indziej.
 * `onSigned` = no-op: przesunięcie na „Wpłaciła" NIE wysyła maili.
 */
export async function moveCard(
  db: AnyDb,
  input: {
    user: StatusActor;
    canUndoSigned: boolean;
    boardId: number;
    assignmentId: number;
    to: PipelineStage;
    reason?: string;
  },
  deps: { audit: AuditFn }
): Promise<Res<{ stage: PipelineStage }>> {
  const board = await getBoard(db, input.boardId);
  if (!board) return fail(404, "Nie znaleziono tablicy.");
  const [row] = await db
    .select({ a: schema.leadAssignments, lead: schema.leads })
    .from(schema.leadAssignments)
    .innerJoin(schema.leads, eq(schema.leadAssignments.leadId, schema.leads.id))
    .where(and(eq(schema.leadAssignments.id, input.assignmentId), boardCardsCondition(board.board)))
    .limit(1);
  if (!row) return fail(404, "Nie znaleziono karty na tej tablicy.");

  const from = pipelineStageOf(row.a.status, row.a.adminStage);
  const to = input.to;
  if (from === to && row.a.boardId === board.board.id) return { ok: true, stage: to };

  const reason = input.reason?.trim();
  if (to === "rezygnacja" && !reason) return fail(400, "Podaj powód rezygnacji.");

  const targetStatus = PIPELINE_STAGE_TO_STATUS[to];
  if (targetStatus !== row.a.status) {
    const res = await changeAssignmentStatusCore(
      db,
      {
        user: input.user,
        assignmentId: row.a.id,
        scope: { kind: "admin", canUndoSigned: input.canUndoSigned },
        change: { status: targetStatus, rejectionReason: reason },
      },
      { onSigned: async () => {}, audit: deps.audit }
    );
    if (!res.ok) return fail(res.status, res.error);
  }

  await db
    .update(schema.leadAssignments)
    .set({ adminStage: to, boardId: board.board.id })
    .where(eq(schema.leadAssignments.id, row.a.id));

  if (from !== to) {
    await db.insert(schema.crmEvents).values({
      assignmentId: row.a.id,
      trainerId: row.a.trainerId,
      kind: "etap",
      summary: `Etap: ${PIPELINE_STAGE_LABELS[from]} → ${PIPELINE_STAGE_LABELS[to]}${to === "rezygnacja" && reason ? ` (${reason})` : ""}`,
    });
  }
  return { ok: true, stage: to };
}
