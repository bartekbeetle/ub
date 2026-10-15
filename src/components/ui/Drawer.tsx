"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, type PanInfo } from "motion/react";
import { DUR, EASE_IN, EASE_OUT, SHIFT, STAGGER, SWIPE_CLOSE } from "@/lib/motion-tokens";

/**
 * WYSUWANY PANEL Z PRAWEJ (drawer).
 *
 * Zamiast przechodzić na podstronę szczegółów, otwieramy panel nad listą — użytkownik
 * cały czas widzi, skąd przyszedł. Stan siedzi w URL (`?panel=<nazwa>&id=<id>`), więc
 * odświeżenie i wklejony link otwierają ten sam panel, a „Wstecz" w przeglądarce go zamyka.
 *
 * Trzy warstwy:
 * - `Drawer` — sam wygląd i zachowanie (animacja, Esc, tło, swipe, focus trap).
 * - `UrlDrawer` — spina Drawer z adresem; treść renderuje serwer i podaje jako `children`.
 * - `PanelRow` / `PanelLink` — otwierają panel natychmiast (szkielet), zanim serwer odpowie.
 */

/* ===== Mały magazyn: „poproszono o panel" + kto go otworzył ===== */

type Requested = { name: string; id: string } | null;
let requested: Requested = null;
let opener: HTMLElement | null = null;
/** true, gdy panel otworzyliśmy push-em w tej karcie — wtedy zamknięcie = `router.back()`. */
let pushedInApp = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getRequested = () => requested;
const setRequested = (r: Requested) => {
  requested = r;
  emit();
};

function panelHref(pathname: string, params: URLSearchParams, name: string, id: string | number) {
  const next = new URLSearchParams(params);
  next.set("panel", name);
  next.set("id", String(id));
  return `${pathname}?${next.toString()}`;
}

function useOpenPanel(name: string, id: string | number) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const href = panelHref(pathname, new URLSearchParams(sp.toString()), name, id);
  const open = useCallback(
    (el: HTMLElement | null) => {
      opener = el;
      pushedInApp = true;
      setRequested({ name, id: String(id) });
      router.push(href, { scroll: false });
    },
    [router, href, name, id]
  );
  return { href, open };
}

/** Elementy, które w klikalnym wierszu mają działać po swojemu, a nie otwierać panelu. */
const INTERACTIVE = "a,button,select,input,textarea,label,summary,[role=button],[data-no-panel]";

/** Wiersz tabeli otwierający panel. Klik w link/przycisk/select w środku działa normalnie. */
export function PanelRow({
  name,
  id,
  className = "",
  children,
}: {
  name: string;
  id: string | number;
  className?: string;
  children: ReactNode;
}) {
  const { open } = useOpenPanel(name, id);
  return (
    <tr
      data-panel-row={`${name}:${id}`}
      className={`cursor-pointer transition-colors duration-150 ${className}`}
      onClick={(e: MouseEvent<HTMLTableRowElement>) => {
        if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return; // zaznaczanie tekstu to nie klik
        open(e.currentTarget.querySelector<HTMLElement>("[data-panel-link]") ?? e.currentTarget);
      }}
    >
      {children}
    </tr>
  );
}

/** Link otwierający panel. Ctrl/środkowy klik dalej otwiera adres w nowej karcie. */
export function PanelLink({
  name,
  id,
  className,
  children,
}: {
  name: string;
  id: string | number;
  className?: string;
  children: ReactNode;
}) {
  const { href, open } = useOpenPanel(name, id);
  return (
    <a
      href={href}
      data-panel-link
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        open(e.currentTarget);
      }}
    >
      {children}
    </a>
  );
}

/* ===== Spięcie z URL ===== */

export function UrlDrawer({
  name,
  contentId,
  title,
  fullHref,
  fallback,
  children,
}: {
  name: string;
  /** Id rekordu, dla którego serwer wyrenderował `children` (null = nic nie wyrenderował). */
  contentId: string | null;
  /** Tytuł w nagłówku; do niego dopisujemy „#<id>". (Funkcji nie da się podać z komponentu serwerowego.) */
  title: string;
  /** Adres pełnej podstrony z `{id}` — w stopce przycisk „Pełna karta". */
  fullHref?: string;
  /** Szkielet pokazywany, zanim dojdzie treść z serwera. */
  fallback: ReactNode;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const req = useSyncExternalStore(subscribe, getRequested, () => null);

  const urlId = sp.get("panel") === name ? sp.get("id") : null;
  const reqId = req?.name === name ? req.id : null;
  const id = urlId ?? reqId;
  const [closing, setClosing] = useState(false);

  // Adres dogonił prośbę → prośba spełniona. Adres zgubił panel (np. „Wstecz") → koniec zamykania.
  useEffect(() => {
    if (urlId && reqId === urlId) setRequested(null);
    if (!urlId && !reqId) setClosing(false);
  }, [urlId, reqId]);

  // Ostatnia treść zostaje w pamięci, żeby panel wyjeżdżał z zawartością, a nie pusty.
  const cache = useRef<{ id: string; node: ReactNode } | null>(null);
  if (contentId && children) cache.current = { id: contentId, node: children };
  const body = id && cache.current?.id === id ? cache.current.node : fallback;

  const close = useCallback(() => {
    setClosing(true);
    setRequested(null);
    if (pushedInApp) {
      pushedInApp = false;
      router.back();
    } else {
      const next = new URLSearchParams(sp.toString());
      next.delete("panel");
      next.delete("id");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [router, pathname, sp]);

  const open = Boolean(id) && !closing;
  const shownId = id ?? cache.current?.id ?? "";

  return (
    <Drawer
      open={open}
      onClose={close}
      title={`${title} #${shownId}`}
      footer={
        <>
          {fullHref && (
            <a href={fullHref.replace("{id}", shownId)} className="btn-outline press mr-auto !px-4 !py-2 !text-sm">
              Pełna karta
            </a>
          )}
          <button type="button" onClick={close} className="btn-primary press !px-5 !py-2 !text-sm">
            Zamknij
          </button>
        </>
      }
      onExited={() => {
        opener?.isConnected && opener.focus();
        opener = null;
      }}
    >
      {body}
    </Drawer>
  );
}

/* ===== Sam panel ===== */

const DrawerCtx = createContext<{ openedAt: number }>({ openedAt: 0 });

export function Drawer({
  open,
  onClose,
  onExited,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  title: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [coarse, setCoarse] = useState(false);
  // Moment otwarcia liczymy w renderze, nie w efekcie: kaskada treści czyta go w tym samym renderze.
  const openedAt = useRef(0);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) openedAt.current = performance.now();
  wasOpen.current = open;
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") trapFocus(e, panelRef.current);
    };
    document.addEventListener("keydown", onKey);
    // Fokus do panelu dopiero po klatce — element musi już stać w DOM.
    const raf = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => {
      html.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence onExitComplete={onExited}>
        {open && (
          <motion.div
            key="drawer-backdrop"
            aria-hidden
            className="fixed inset-0 z-[60] bg-ink-soft/25 backdrop-blur-[7px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.enter, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: DUR.exit, ease: EASE_IN } }}
            onClick={onClose}
          />
        )}
        {open && (
          <motion.aside
            key="drawer-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="fixed inset-y-0 right-0 z-[61] flex w-full flex-col bg-white text-ink outline-none shadow-[-24px_0_60px_-12px_rgba(45,36,36,0.28)] sm:w-[480px] sm:rounded-l-[20px] lg:w-[520px]"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1, transition: { duration: DUR.enter, ease: EASE_OUT } }}
            exit={{ x: "100%", opacity: 0, transition: { duration: DUR.exit, ease: EASE_IN } }}
            drag={coarse ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.6 }}
            dragDirectionLock
            onDragEnd={(_, info: PanInfo) => {
              if (info.offset.x > SWIPE_CLOSE.offset || info.velocity.x > SWIPE_CLOSE.velocity) onClose();
            }}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
              <h2 id={titleId} className="min-w-0 truncate font-serif text-lg font-bold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Zamknij panel"
                className="press -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-sand-50 hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              <DrawerCtx.Provider value={{ openedAt: openedAt.current }}>{children}</DrawerCtx.Provider>
            </div>
            {footer && (
              <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 bg-white px-5 py-3 sm:px-6">
                {footer}
              </footer>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body
  );
}

/**
 * Element treści panelu — wchodzi kaskadowo, ale dopiero gdy panel skończy wjeżdżać.
 * Treść z serwera może dojść później niż sam panel; wtedy opóźnienie się skraca, nie sumuje.
 */
export function DrawerItem({ i = 0, className, children }: { i?: number; className?: string; children: ReactNode }) {
  const { openedAt } = useContext(DrawerCtx);
  const [delay] = useState(() => {
    const left = openedAt ? Math.max(0, openedAt + DUR.enter * 1000 - performance.now()) / 1000 : 0;
    return left + i * STAGGER.drawer;
  });
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: SHIFT.drawerItem }}
      animate={{ opacity: 1, y: 0, transition: { duration: DUR.enter, ease: EASE_OUT, delay } }}
    >
      {children}
    </motion.div>
  );
}

function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const items = Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null);
  if (items.length === 0) {
    e.preventDefault();
    root.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  } else if (!root.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}
