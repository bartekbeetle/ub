"use client";

import { useEffect, useState, type ReactNode } from "react";

type Mode = "lista" | "kanban";

/**
 * Przełącznik „Lista / Kanban". Wybór pamiętamy w localStorage osobno dla każdego użytkownika
 * (`storageKey` zawiera jego id). Brak zapisu (pierwsza wizyta albo zablokowany storage)
 * = Kanban na desktopie (≥768 px), lista na telefonie. Obie wersje przychodzą z serwera jako
 * gotowe węzły, więc lista zostaje nietknięta, a Kanban dostaje dokładnie te same, już
 * przefiltrowane dane.
 */
export function ViewSwitcher({
  storageKey,
  list,
  kanban,
}: {
  storageKey: string;
  list: ReactNode;
  kanban: ReactNode;
}) {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(storageKey);
    } catch {
      /* storage zablokowany (tryb prywatny, polityka przeglądarki): zostaje domyślny */
    }
    if (saved === "lista" || saved === "kanban") setMode(saved);
    else setMode(window.matchMedia("(min-width: 768px)").matches ? "kanban" : "lista");
  }, [storageKey]);

  function choose(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      /* jw. */
    }
  }

  const btn = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => choose(m)}
      aria-pressed={mode === m}
      className={`min-h-[40px] rounded-full px-4 text-sm font-semibold transition-colors ${
        mode === m ? "bg-sand-700 text-white" : "text-sand-700 hover:bg-sand-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mt-5 flex justify-end">
        <div role="group" aria-label="Widok" className="inline-flex gap-1 rounded-full border border-sand-600 bg-white p-1">
          {btn("lista", "Lista")}
          {btn("kanban", "Kanban")}
        </div>
      </div>
      {mode === null ? (
        <div className="mt-4 min-h-[240px]" aria-busy="true" />
      ) : mode === "kanban" ? (
        kanban
      ) : (
        list
      )}
    </div>
  );
}
