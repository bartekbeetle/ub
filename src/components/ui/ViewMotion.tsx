"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatPln } from "@/lib/utils";
import { DUR, EASE_OUT } from "@/lib/motion-tokens";

/**
 * WEJŚCIE WIDOKU + WYKRESY NA WEJŚCIE W EKRAN.
 *
 * Owija treść każdej strony panelu (przez `template.tsx`, który Next montuje od nowa przy
 * każdej zmianie zakładki — dlatego kaskada odpala się przy każdym przejściu).
 * - każda `.card` dostaje numer `--i` → kaskada fade + 8 px w CSS (`.view-enter`),
 * - elementy z `[data-reveal]` dostają `data-inview`, gdy wjadą w ekran → dopiero wtedy
 *   ruszają ich słupki i paski (`.anim-bar-x`, `.anim-bar-y` w `globals.css`).
 * Sama animacja jest w CSS (transform + opacity), tu tylko numeracja i obserwator.
 */
export function ViewEnter({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // Numerujemy prawdziwe karty, nie szkielet z `loading.tsx` — ten znika, gdy dojdą dane.
    const number = () => {
      let i = 0;
      root.querySelectorAll<HTMLElement>(".card").forEach((el) => {
        if (el.closest("[role=status]")) return;
        // Raz nadany numer zostaje — zmiana opóźnienia po animacji cofnęłaby kartę do stanu „przed”.
        if (!el.style.getPropertyValue("--i")) el.style.setProperty("--i", String(Math.min(i, 10)));
        i++;
      });
    };
    number();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.inview = "true";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    const watch = (scope: ParentNode) =>
      scope.querySelectorAll<HTMLElement>("[data-reveal]:not([data-inview])").forEach((el) => io.observe(el));
    watch(root);
    // Treść dochodząca później (Suspense, odświeżenie danych) też ma dostać obserwatora.
    const mo = new MutationObserver(() => {
      number();
      watch(root);
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="view-enter">
      {children}
    </div>
  );
}

type NumberKind = "int" | "pct" | "pln";
const fmt = (v: number, kind: NumberKind) =>
  kind === "pln" ? formatPln(v) : `${Math.round(v).toLocaleString("pl-PL")}${kind === "pct" ? "%" : ""}`;

/**
 * Liczba, która dojeżdża do wartości: count-up przy pierwszym pokazaniu (800 ms, gdy wjedzie
 * w ekran), a przy zmianie danych płynnie od starej do nowej (400 ms) — nigdy skok.
 * Tekst podmieniamy bezpośrednio w DOM, bez re-renderu Reacta na każdą klatkę.
 * Przy `prefers-reduced-motion` od razu pokazuje wartość docelową.
 */
export function AnimatedNumber({ value, kind = "int", className }: { value: number; kind?: NumberKind; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const write = (v: number) => {
      el.textContent = fmt(v, kind);
    };
    if (reduce) {
      shown.current = value;
      write(value);
      return;
    }
    let ctl: ReturnType<typeof animate> | undefined;
    const run = () => {
      const from = shown.current ?? 0;
      const first = shown.current === null;
      ctl = animate(from, value, {
        duration: first ? DUR.countUp : DUR.number,
        ease: EASE_OUT,
        onUpdate: (v) => {
          shown.current = v;
          write(v);
        },
      });
    };
    if (shown.current !== null) {
      run();
      return () => ctl?.stop();
    }
    // Pierwszy raz: czekamy, aż liczba będzie widoczna.
    write(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      run();
    });
    io.observe(el);
    return () => {
      io.disconnect();
      ctl?.stop();
    };
  }, [value, kind, reduce]);

  // SSR i brak JS: od razu prawdziwa wartość (czytnik ekranu też dostaje ją bez animacji).
  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`} aria-label={fmt(value, kind)}>
      {fmt(value, kind)}
    </span>
  );
}
