"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KanbanBoard, type KanbanColumn, type MoveOutcome } from "@/components/kanban/KanbanBoard";
import { FUNNEL_STAGES, FUNNEL_STAGE_COLORS, FUNNEL_STAGE_LABELS } from "@/lib/pipeline-stages";
import { daysAgo, telHref, type BoardOption } from "./shared";

export type FunnelItem = {
  id: number;
  name: string;
  phone: string;
  category: string;
  courseTitle: string | null;
  place: string;
  createdAt: string;
  stage: string;
  hasPhoneConsent: boolean;
};

const COLUMNS: KanbanColumn[] = FUNNEL_STAGES.map((s) => ({
  id: s,
  label: FUNNEL_STAGE_LABELS[s],
  badgeClass: FUNNEL_STAGE_COLORS[s],
  collapsible: s === "odrzucona",
  defaultCollapsed: s === "odrzucona",
}));

/**
 * LEJEK: kursantki bez przydziału. Bartek kwalifikuje po telefonie i przypisuje na tablicę trenerki.
 * Przypisanie NIE wysyła nic trenerce — dane kursantki zostają w CRM-ie UB.
 */
export function FunnelKanban({ items, boards }: { items: FunnelItem[]; boards: BoardOption[] }) {
  const router = useRouter();

  async function commitMove(item: FunnelItem, to: string): Promise<MoveOutcome> {
    const res = await fetch(`/api/admin/crm-kursantki/lejek/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: to }),
    });
    if (res.ok) {
      router.refresh();
      return { ok: true };
    }
    return { ok: false, error: (await res.json().catch(() => ({}))).error ?? "Nie udało się zmienić kolumny." };
  }

  return (
    <KanbanBoard
      items={items}
      columns={COLUMNS}
      idOf={(i) => i.id}
      columnOf={(i) => i.stage}
      nameOf={(i) => i.name}
      canDrag={() => true}
      emptyText="Brak kursantek"
      commitMove={commitMove}
      renderCard={(i) => <FunnelCard item={i} boards={boards} />}
    />
  );
}

function FunnelCard({ item, boards }: { item: FunnelItem; boards: BoardOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Najpierw tablice z kategorią tej kursantki — to te, na które zwykle trafi.
  const sorted = [...boards].sort((a, b) => Number(b.category === item.category) - Number(a.category === item.category));

  async function assign(boardId: number) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/crm-kursantki/lejek/${item.id}/przypisz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error ?? "Nie udało się przypisać.");
  }

  return (
    <div className="text-sm" suppressHydrationWarning>
      <Link href={`/admin/kursantki/${item.id}`} className="font-semibold text-ink-soft hover:underline">
        {item.name}
      </Link>
      <p className="mt-0.5 text-xs text-ink-soft">{item.courseTitle || item.category}</p>
      <p className="text-xs text-muted">
        {item.place} · {daysAgo(item.createdAt)}
      </p>
      {item.hasPhoneConsent ? (
        <a href={telHref(item.phone)} className="mt-1 inline-block text-xs font-semibold text-sand-700 hover:underline">
          {item.phone}
        </a>
      ) : (
        <span className="mt-1.5 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
          Brak zgody na telefon — tylko e-mail
        </span>
      )}
      {item.stage !== "odrzucona" && (
        <label className="mt-2 block">
          <span className="sr-only">Przypisz {item.name} do tablicy</span>
          <select
            disabled={busy || sorted.length === 0}
            defaultValue=""
            onChange={(e) => e.target.value && assign(Number(e.target.value))}
            className="input !py-1 !text-xs"
          >
            <option value="">{sorted.length ? "Przypisz trenerce…" : "Najpierw dodaj trenerkę"}</option>
            {sorted.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
