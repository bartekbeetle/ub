"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";

/**
 * Wspólna tablica Kanban dla CRM trenerki i CRM akademii (admin). NIE zna żadnego API ani bazy:
 * o przeniesieniu decyduje funkcja `commitMove` przekazana przez stronę, która woła ISTNIEJĄCĄ
 * trasę zmiany etapu/statusu. Dzięki temu rozliczenia, izolacja trenerek i dziennik audytu
 * zostają w jednym miejscu (po stronie serwera), a tablica jest tylko innym widokiem.
 *
 * Przenoszenie: myszą/dotykiem za uchwyt „⠿", klawiaturą (Spacja, strzałki lewo/prawo, Spacja)
 * i selectem „Przenieś do…" (na telefonie, gdzie przeciąganie w przewijanym poziomo kontenerze
 * bywa zawodne). Zmiana jest optymistyczna; błąd serwera cofa kartę i pokazuje komunikat.
 */

export type KanbanColumn = {
  id: string;
  label: string;
  badgeClass: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export type MoveOutcome = { ok: true } | { ok: false; error: string };

type Props<T> = {
  items: T[];
  columns: KanbanColumn[];
  idOf: (item: T) => number;
  columnOf: (item: T) => string;
  nameOf: (item: T) => string;
  canDrag: (item: T) => boolean;
  /** Podpis przy karcie, której nie wolno ruszać (np. naliczony zapis). */
  lockedLabel?: string;
  renderCard: (item: T) => ReactNode;
  /** Okno potwierdzenia/powodu. Zwraca ładunek dla `commitMove` albo `null`, gdy użytkownik anulował. */
  confirmMove?: (item: T, to: string) => Promise<unknown | null>;
  commitMove: (item: T, to: string, payload: unknown) => Promise<MoveOutcome>;
  emptyText?: string;
};

const cardKey = (id: number) => `card:${id}`;
const colKey = (id: string) => `col:${id}`;

/** Klawisze ←/→ przeskakują do sąsiedniej KOLUMNY (domyślne 25 px na strzałkę byłoby męczące). */
const columnJump: KeyboardCoordinateGetter = (event, { context: { droppableRects, droppableContainers, collisionRect } }) => {
  if (!collisionRect) return;
  const dir = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (!dir) return;
  event.preventDefault();
  const cols = droppableContainers
    .getEnabled()
    .map((c) => ({ rect: droppableRects.get(c.id) }))
    .filter((c): c is { rect: NonNullable<typeof c.rect> } => Boolean(c.rect))
    .sort((a, b) => a.rect.left - b.rect.left);
  const cx = collisionRect.left + collisionRect.width / 2;
  const idx = cols.findIndex((c) => cx >= c.rect.left && cx <= c.rect.right);
  const next = cols[(idx < 0 ? (dir > 0 ? -1 : cols.length) : idx) + dir];
  if (!next) return;
  return { x: next.rect.left + 8, y: next.rect.top + 8 };
};

export function KanbanBoard<T>({
  items,
  columns,
  idOf,
  columnOf,
  nameOf,
  canDrag,
  lockedLabel,
  renderCard,
  confirmMove,
  commitMove,
  emptyText = "Brak kart",
}: Props<T>) {
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.filter((c) => c.defaultCollapsed).map((c) => [c.id, true]))
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  // Nowe dane z serwera (po `router.refresh()`) są źródłem prawdy: kasujemy przesunięcia optymistyczne.
  useEffect(() => setOverrides({}), [items]);
  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnJump })
  );

  const byId = useMemo(() => new Map(items.map((i) => [idOf(i), i])), [items, idOf]);
  const colOf = (item: T) => overrides[idOf(item)] ?? columnOf(item);
  const labelOf = (colId: string) => columns.find((c) => c.id === colId)?.label ?? colId;

  async function move(item: T, to: string) {
    const id = idOf(item);
    if (busy.has(id) || colOf(item) === to) return;
    setError(null);
    setInfo(null);
    const payload = confirmMove ? await confirmMove(item, to) : true;
    if (payload === null) return;
    setOverrides((o) => ({ ...o, [id]: to }));
    setBusy((b) => new Set(b).add(id));
    let res: MoveOutcome;
    try {
      res = await commitMove(item, to, payload);
    } catch {
      res = { ok: false, error: "Brak połączenia z serwerem. Karta wróciła na poprzednie miejsce." };
    }
    setBusy((b) => {
      const n = new Set(b);
      n.delete(id);
      return n;
    });
    if (res.ok) {
      setInfo(`Przeniesiono: ${nameOf(item)} → ${labelOf(to)}.`);
    } else {
      setOverrides((o) => {
        const n = { ...o };
        delete n[id];
        return n;
      });
      setError(res.error);
    }
  }

  function onDragStart(e: DragStartEvent) {
    const id = Number(String(e.active.id).replace("card:", ""));
    setActiveId(id);
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = Number(String(e.active.id).replace("card:", ""));
    const overId = e.over ? String(e.over.id) : "";
    const item = byId.get(id);
    if (item && overId.startsWith("col:")) void move(item, overId.slice(4));
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const it = byId.get(Number(String(active.id).replace("card:", "")));
      return `Podniesiono kartę: ${it ? nameOf(it) : ""}.`;
    },
    onDragOver: ({ active, over }) => {
      const it = byId.get(Number(String(active.id).replace("card:", "")));
      return over ? `${it ? nameOf(it) : "Karta"} jest nad kolumną ${labelOf(String(over.id).replace("col:", ""))}.` : undefined;
    },
    onDragEnd: ({ active, over }) => {
      const it = byId.get(Number(String(active.id).replace("card:", "")));
      return over
        ? `Upuszczono kartę ${it ? nameOf(it) : ""} w kolumnie ${labelOf(String(over.id).replace("col:", ""))}.`
        : "Upuszczono poza kolumną. Nic nie zmieniono.";
    },
    onDragCancel: () => "Anulowano przenoszenie. Karta została na miejscu.",
  };

  const activeItem = activeId != null ? byId.get(activeId) : undefined;

  return (
    <div className="mt-4">
      <div aria-live="polite" className="sr-only">{info}</div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Aby przenieść kartę, naciśnij Spację. Strzałkami w lewo i w prawo wybierz kolumnę, Spacją upuść kartę, Escape anuluje.",
          },
        }}
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:snap-none md:px-0">
          {columns.map((col) => {
            const cards = items.filter((i) => colOf(i) === col.id);
            return (
              <Column
                key={col.id}
                col={col}
                count={cards.length}
                collapsed={Boolean(collapsed[col.id])}
                onToggle={() => setCollapsed((c) => ({ ...c, [col.id]: !c[col.id] }))}
              >
                {cards.length === 0 && (
                  <p className="rounded-lg border border-dashed border-sand-300 px-3 py-6 text-center text-xs text-muted">{emptyText}</p>
                )}
                {cards.map((item) => (
                  <Card
                    key={idOf(item)}
                    id={idOf(item)}
                    name={nameOf(item)}
                    draggable={canDrag(item) && !busy.has(idOf(item))}
                    locked={!canDrag(item)}
                    lockedLabel={lockedLabel}
                    pending={busy.has(idOf(item))}
                    current={colOf(item)}
                    columns={columns}
                    onSelectMove={(to) => void move(item, to)}
                  >
                    {renderCard(item)}
                  </Card>
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
          {activeItem ? (
            <div className="w-[260px] rotate-1 rounded-[12px] border border-sand-600 bg-white p-3 shadow-[var(--shadow-card)]">
              {renderCard(activeItem)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  col,
  count,
  collapsed,
  onToggle,
  children,
}: {
  col: KanbanColumn;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey(col.id) });
  const bodyId = `kanban-col-${col.id}`;
  return (
    <section
      ref={setNodeRef}
      aria-label={`${col.label}, kart: ${count}`}
      className={`w-[82vw] max-w-[320px] shrink-0 snap-start rounded-[12px] border bg-sand-50 p-2.5 transition-colors md:w-auto md:min-w-[240px] md:max-w-none md:flex-1 ${
        isOver ? "border-sand-700 bg-sand-100 ring-2 ring-sand-600" : "border-sand-200"
      } ${collapsed ? "md:!flex-none md:!min-w-[200px]" : ""}`}
    >
      <header className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-bold ${col.badgeClass}`}>{col.label}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink-soft">{count}</span>
          {col.collapsible && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              className="min-h-[32px] rounded-full px-2.5 text-xs font-semibold text-sand-700 hover:bg-sand-100"
            >
              {collapsed ? "Pokaż" : "Zwiń"}
            </button>
          )}
        </span>
      </header>
      <div id={bodyId} hidden={collapsed} className="space-y-2.5 md:max-h-[70vh] md:overflow-y-auto">
        {children}
      </div>
    </section>
  );
}

function Card({
  id,
  name,
  draggable,
  locked,
  lockedLabel,
  pending,
  current,
  columns,
  onSelectMove,
  children,
}: {
  id: number;
  name: string;
  draggable: boolean;
  locked: boolean;
  lockedLabel?: string;
  pending: boolean;
  current: string;
  columns: KanbanColumn[];
  onSelectMove: (to: string) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: cardKey(id),
    disabled: !draggable,
  });
  return (
    <article
      ref={setNodeRef}
      aria-busy={pending}
      className={`rounded-[12px] border border-sand-200 bg-white p-3 shadow-[var(--shadow-soft)] ${isDragging ? "opacity-40" : ""} ${
        pending ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {draggable ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            aria-roledescription="karta do przeniesienia"
            aria-label={`Przenieś kartę: ${name}`}
            className="-ml-1 mt-0.5 flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-lg leading-none text-sand-700 hover:bg-sand-100 active:cursor-grabbing"
          >
            ⠿
          </button>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {locked && lockedLabel && <p className="mt-2 text-xs text-muted">{lockedLabel}</p>}
      {!locked && (
        <div className="mt-2.5 md:hidden">
          <label className="sr-only" htmlFor={`kanban-move-${id}`}>Przenieś kartę {name} do kolumny</label>
          <select
            id={`kanban-move-${id}`}
            value=""
            disabled={pending}
            onChange={(e) => e.target.value && onSelectMove(e.target.value)}
            className="input !min-h-[44px] !py-2 !text-sm"
          >
            <option value="">Przenieś do…</option>
            {columns
              .filter((c) => c.id !== current)
              .map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
          </select>
        </div>
      )}
    </article>
  );
}
