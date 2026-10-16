/**
 * Tokeny ruchu panelu — jedno miejsce na czasy i krzywe.
 * Animujemy wyłącznie transform i opacity (kompozytor GPU, 60 fps także na telefonie).
 * `prefers-reduced-motion` obsługuje `<MotionConfig reducedMotion="user">`: zostają same fade'y.
 */

/** Krzywa „wyjazdu" — szybki start, długie miękkie hamowanie. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Krzywa zamknięcia — przyspiesza na wyjściu, żeby nie wisiało. */
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** Czasy w sekundach (tak liczy `motion`). */
export const DUR = {
  micro: 0.15, // hover, wciśnięcie, wygaszenie zakładki
  exit: 0.22, // zamknięcie panelu
  enter: 0.3, // wjazd panelu
  view: 0.35, // wejście kart widoku
  number: 0.4, // przeliczenie liczby przy zmianie
  countUp: 0.8, // count-up KPI przy pierwszym renderze
  highlight: 1.5, // wygaszenie podświetlenia po zapisie
} as const;

/** Odstęp kaskady w sekundach. */
export const STAGGER = {
  drawer: 0.04,
  view: 0.05,
} as const;

/** Przesunięcia kaskady w px. */
export const SHIFT = {
  drawerItem: 6,
  viewItem: 8,
} as const;

/** Próg zamknięcia panelu przeciągnięciem w prawo (mobile). */
export const SWIPE_CLOSE = { offset: 120, velocity: 500 } as const;

/** Sprężyna przełączników (gałka toggle'a) — lekki overshoot, bez bujania. */
export const SPRING = { type: "spring", stiffness: 520, damping: 32, mass: 0.7 } as const;
