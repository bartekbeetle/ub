"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KanbanBoard, type KanbanColumn, type MoveOutcome } from "@/components/kanban/KanbanBoard";
import {
  BUR_SEGMENT_COLORS,
  BUR_SEGMENT_SHORT,
  PROSPECT_PIPELINE_ORDER,
  PROSPECT_PRIORITY_COLORS,
  PROSPECT_PRIORITY_LABELS,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
} from "@/lib/constants";

export type KanbanProspect = {
  id: number;
  name: string;
  status: string;
  city: string | null;
  voivodeshipName: string | null;
  priority: string;
  burSegment: string;
  /** Data następnego kroku, już sformatowana po stronie serwera (strefa Warszawy). */
  nextActionLabel: string | null;
  nextActionNote: string | null;
  /** Dni po terminie następnego kroku (0 = nie zaległe). */
  overdueDays: number;
  selfRegistered: boolean;
};

// Kolejność lejka, a martwe statusy na końcu i zwinięte (da się je rozwinąć i upuścić w nie kartę).
const COLUMNS: KanbanColumn[] = [
  ...PROSPECT_PIPELINE_ORDER.map((s) => ({ id: s, label: PROSPECT_STATUS_LABELS[s], badgeClass: PROSPECT_STATUS_COLORS[s] })),
  ...(["odrzucony", "parking"] as const).map((s) => ({
    id: s,
    label: PROSPECT_STATUS_LABELS[s],
    badgeClass: PROSPECT_STATUS_COLORS[s],
    collapsible: true,
    defaultCollapsed: true,
  })),
];

/**
 * Kanban CRM akademii (admin). Status zmienia ten sam PATCH co `ProspectStatusSelect`
 * (`/api/admin/prospekty/:id`: requireAdmin + wpis na osi czasu + logAdminAction).
 */
export function ProspectKanban({ items }: { items: KanbanProspect[] }) {
  const router = useRouter();

  async function commitMove(item: KanbanProspect, to: string): Promise<MoveOutcome> {
    const res = await fetch(`/api/admin/prospekty/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    if (res.ok) {
      router.refresh();
      return { ok: true };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Nie udało się zmienić statusu." };
  }

  return (
    <KanbanBoard
      items={items}
      columns={COLUMNS}
      idOf={(i) => i.id}
      columnOf={(i) => i.status}
      nameOf={(i) => i.name}
      canDrag={() => true}
      emptyText="Brak akademii w tym statusie"
      commitMove={commitMove}
      renderCard={(p) => (
        <div className="text-sm">
          <Link href={`/admin/crm-trenerki/${p.id}`} className="font-semibold text-sand-700 hover:underline">
            {p.name}
          </Link>
          {p.selfRegistered && (
            <span className="ml-1.5 inline-flex rounded-full bg-money-bg px-2 py-0.5 text-[11px] font-bold text-money-dark">
              zgłosiła się sama
            </span>
          )}
          <p className="mt-0.5 text-xs text-muted">
            {p.city ?? "brak miasta"}
            {p.voivodeshipName ? `, ${p.voivodeshipName}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${PROSPECT_PRIORITY_COLORS[p.priority]}`}>
              {PROSPECT_PRIORITY_LABELS[p.priority]}
            </span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${BUR_SEGMENT_COLORS[p.burSegment]}`}>
              {BUR_SEGMENT_SHORT[p.burSegment]}
            </span>
          </div>
          {p.nextActionLabel && (
            <p className={`mt-1.5 text-xs ${p.overdueDays > 0 ? "font-semibold text-red-700" : "text-ink-soft"}`}>
              Następny krok: {p.nextActionLabel}
              {p.overdueDays > 0 ? ` (zaległe o ${p.overdueDays} dn.)` : ""}
            </p>
          )}
          {p.nextActionNote && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{p.nextActionNote}</p>}
        </div>
      )}
    />
  );
}
