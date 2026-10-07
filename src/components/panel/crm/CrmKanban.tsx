"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { KanbanBoard, type KanbanColumn, type MoveOutcome } from "@/components/kanban/KanbanBoard";
import { Modal } from "@/components/kanban/Modal";
import { CRM_STAGES, CRM_STAGE_COLORS, CRM_STAGE_LABELS, isCrmStage, type CrmStage } from "@/lib/crm-stages";

/** Pola z `listCrmLeads` (ta sama, zawężona do trenerki zapytanie co lista). */
export type KanbanLead = {
  assignmentId: number;
  name: string;
  category: string;
  courseTitle: string | null;
  city: string | null;
  stage: CrmStage;
  nextContactAt: string | null;
  due: boolean;
  anonymized: boolean;
  createdAt: string;
  lastActivityAt: string | null;
};

const ymdFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" });
const ymd = (iso: string) => ymdFmt.format(new Date(iso));
function daysBetween(fromIso: string, to = new Date()): number {
  const a = Date.parse(`${ymd(fromIso)}T00:00:00Z`);
  const b = Date.parse(`${ymdFmt.format(to)}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
function ago(iso: string | null): string {
  if (!iso) return "brak aktywności";
  const d = daysBetween(iso);
  return d === 0 ? "dziś" : d === 1 ? "wczoraj" : `${d} dni temu`;
}

const COLUMNS: KanbanColumn[] = CRM_STAGES.map((s) => ({ id: s, label: CRM_STAGE_LABELS[s], badgeClass: CRM_STAGE_COLORS[s] }));

type Pending =
  | { kind: "zapisana"; name: string; resolve: (v: unknown | null) => void }
  | { kind: "rezygnacja"; name: string; resolve: (v: unknown | null) => void };

/**
 * Widok Kanban CRM trenerki. Zmiana etapu idzie tą samą trasą co `StageControl`
 * (`PATCH /api/panel/crm/:id/stage`), więc naliczanie, maile i izolacja po `trainer_id`
 * zostają po stronie serwera. Tu nie ma żadnego zapisu do bazy.
 */
export function CrmKanban({ items }: { items: KanbanLead[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function confirmMove(item: KanbanLead, to: string): Promise<unknown | null> {
    if (to === "zapisana" || to === "rezygnacja") {
      setReason("");
      return new Promise((resolve) => setPending({ kind: to, name: item.name, resolve }));
    }
    return Promise.resolve({});
  }

  async function commitMove(item: KanbanLead, to: string, payload: unknown): Promise<MoveOutcome> {
    if (!isCrmStage(to)) return { ok: false, error: "Nieznany etap." };
    const res = await fetch(`/api/panel/crm/${item.assignmentId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: to, rejectionReason: (payload as { reason?: string }).reason }),
    });
    if (res.ok) {
      router.refresh();
      return { ok: true };
    }
    const msg = (await res.json().catch(() => ({}))).error as string | undefined;
    if (res.status === 409) return { ok: false, error: msg ?? "Zapis jest już naliczony. Napisz do biura Uniwersytetu Beauty." };
    return { ok: false, error: msg ?? "Nie udało się zmienić etapu." };
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
        canDrag={(i) => i.stage !== "zapisana"}
        lockedLabel="Zapis naliczony. Korektę zgłoś do biura Uniwersytetu Beauty."
        emptyText="Brak kursantek na tym etapie"
        confirmMove={confirmMove}
        commitMove={commitMove}
        renderCard={(i) => <LeadCard lead={i} />}
      />
      {pending?.kind === "zapisana" && (
        <Modal title="Oznaczyć jako zapisaną?" onCancel={() => close(null)}>
          <p className="text-sm text-ink-soft">
            <strong>{pending.name}</strong>: to naliczy opłatę za zapisaną kursantkę i nie da się tego cofnąć samodzielnie.
            Korektę zgłasza się do biura.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => close(null)} className="btn-outline !px-5 !py-2 !text-sm">Anuluj</button>
            <button type="button" onClick={() => close({})} className="btn-money !px-5 !py-2 !text-sm">Oznacz jako zapisaną</button>
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
            <label htmlFor="kanban-reason" className="label">Powód rezygnacji: {pending.name}</label>
            <textarea
              id="kanban-reason"
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

function LeadCard({ lead }: { lead: KanbanLead }) {
  const today = ymdFmt.format(new Date());
  const overdue = lead.due && lead.nextContactAt ? ymd(lead.nextContactAt) < today : false;
  const assignedDays = daysBetween(lead.createdAt);
  return (
    <div className="text-sm" suppressHydrationWarning>
      <Link href={`/panel/leady/${lead.assignmentId}`} className="font-semibold text-ink-soft hover:underline">
        {lead.name}
      </Link>
      <p className="mt-0.5 text-xs text-ink-soft">{lead.courseTitle || lead.category}</p>
      <p className="text-xs text-muted">
        {lead.city || "brak miasta"} · przydzielona {assignedDays === 0 ? "dziś" : `${assignedDays} dn. temu`}
      </p>
      {lead.due && (
        <span className="mt-1.5 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
          {overdue ? "Kontakt zaległy" : "Kontakt dziś"}
        </span>
      )}
      <p className="mt-1.5 text-xs text-muted">Ostatnia aktywność: {ago(lead.lastActivityAt)}</p>
    </div>
  );
}
