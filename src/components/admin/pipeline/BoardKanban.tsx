"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { KanbanBoard, type KanbanColumn, type MoveOutcome } from "@/components/kanban/KanbanBoard";
import { Modal } from "@/components/kanban/Modal";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_COLORS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_TO_STATUS,
  isPipelineStage,
} from "@/lib/pipeline-stages";
import { daysAgo, telHref } from "./shared";

export type BoardItem = {
  assignmentId: number;
  leadId: number;
  name: string;
  phone: string;
  courseTitle: string | null;
  place: string;
  stage: string;
  assignedAt: string;
  hasPhoneConsent: boolean;
  lastEvent: string | null;
  /** Tylko dla superadmina; zwykły admin dostaje null. */
  amount: number | null;
};

const COLUMNS: KanbanColumn[] = PIPELINE_STAGES.map((s) => ({
  id: s,
  label: PIPELINE_STAGE_LABELS[s],
  badgeClass: PIPELINE_STAGE_COLORS[s],
  collapsible: s === "rezygnacja",
  defaultCollapsed: s === "rezygnacja",
}));

const isBilled = (stage: string) => isPipelineStage(stage) && PIPELINE_STAGE_TO_STATUS[stage] === "zapisana";

type Pending =
  | { kind: "wplacila"; name: string; resolve: (v: unknown | null) => void }
  | { kind: "rezygnacja"; name: string; resolve: (v: unknown | null) => void };

/**
 * TABLICA trenerka × kategoria. Zmiana etapu → `PATCH /api/admin/crm-kursantki/tablice/:id/karty/:id`;
 * naliczenie i blokady rozliczeń są po stronie serwera. Tu żadnego zapisu do bazy.
 */
export function BoardKanban({ boardId, items }: { boardId: number; items: BoardItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function confirmMove(item: BoardItem, to: string): Promise<unknown | null> {
    // Potwierdzenie tylko przy WEJŚCIU w naliczenie (z „Wpłaciła" na „Dotarła" nic się nie nalicza).
    if ((to === "wplacila" && !isBilled(item.stage)) || to === "rezygnacja") {
      setReason("");
      return new Promise((resolve) => setPending({ kind: to as Pending["kind"], name: item.name, resolve }));
    }
    return Promise.resolve({});
  }

  async function commitMove(item: BoardItem, to: string, payload: unknown): Promise<MoveOutcome> {
    const res = await fetch(`/api/admin/crm-kursantki/tablice/${boardId}/karty/${item.assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: to, reason: (payload as { reason?: string }).reason }),
    });
    if (res.ok) {
      router.refresh();
      return { ok: true };
    }
    return { ok: false, error: (await res.json().catch(() => ({}))).error ?? "Nie udało się zmienić etapu." };
  }

  function close(value: unknown | null) {
    pending?.resolve(value);
    setPending(null);
  }

  return (
    <>
      <KanbanBoard
        items={items}
        columns={COLUMNS}
        idOf={(i) => i.assignmentId}
        columnOf={(i) => i.stage}
        nameOf={(i) => i.name}
        // Blokadę cofnięcia naliczenia trzyma serwer (403 dla zwykłego admina) — tu nie dublujemy reguły.
        canDrag={() => true}
        emptyText="Pusto"
        confirmMove={confirmMove}
        commitMove={commitMove}
        renderCard={(i) => <BoardCard item={i} />}
      />
      {pending?.kind === "wplacila" && (
        <Modal title="Kursantka wpłaciła?" onCancel={() => close(null)}>
          <p className="text-sm text-ink-soft">
            <strong>{pending.name}</strong>: to nalicza Twoją prowizję od trenerki (trafi do Rozliczeń). Maile nie wychodzą.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => close(null)} className="btn-outline !px-5 !py-2 !text-sm">Anuluj</button>
            <button type="button" onClick={() => close({})} className="btn-money !px-5 !py-2 !text-sm">Tak, wpłaciła</button>
          </div>
        </Modal>
      )}
      {pending?.kind === "rezygnacja" && (
        <Modal title="Rezygnacja kursantki" onCancel={() => close(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim()) close({ reason: reason.trim() });
              else reasonRef.current?.focus();
            }}
          >
            <label htmlFor="board-reason" className="label">Powód rezygnacji: {pending.name}</label>
            <textarea
              id="board-reason"
              ref={reasonRef}
              autoFocus
              required
              maxLength={1000}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => close(null)} className="btn-outline !px-5 !py-2 !text-sm">Anuluj</button>
              <button type="submit" disabled={!reason.trim()} className="btn-primary !px-5 !py-2 !text-sm disabled:opacity-50">Zapisz rezygnację</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function BoardCard({ item }: { item: BoardItem }) {
  return (
    <div className="text-sm" suppressHydrationWarning>
      <Link href={`/admin/kursantki/${item.leadId}`} className="font-semibold text-ink-soft hover:underline">
        {item.name}
      </Link>
      {item.courseTitle && <p className="mt-0.5 text-xs text-ink-soft">{item.courseTitle}</p>}
      <p className="text-xs text-muted">
        {item.place} · przypisana {daysAgo(item.assignedAt)}
      </p>
      {item.phone && item.hasPhoneConsent && (
        <a href={telHref(item.phone)} className="mt-1 inline-block text-xs font-semibold text-sand-700 hover:underline">
          {item.phone}
        </a>
      )}
      {!item.hasPhoneConsent && (
        <span className="mt-1.5 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
          Brak zgody na telefon
        </span>
      )}
      {item.amount !== null && item.amount > 0 && (
        <span className="ml-1 mt-1.5 inline-flex rounded-full bg-money-bg px-2 py-0.5 text-[11px] font-bold text-money-dark">
          {item.amount} zł
        </span>
      )}
      {item.lastEvent && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{item.lastEvent}</p>}
    </div>
  );
}
