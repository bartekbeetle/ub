"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Okno dialogowe na natywnym `<dialog>`: pułapka fokusu, Esc i `aria-modal` robi przeglądarka.
 * Po zamknięciu oddajemy fokus elementowi, który go miał przed otwarciem.
 */
export function Modal({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    const prev = document.activeElement as HTMLElement | null;
    if (el && !el.open) el.showModal();
    return () => {
      if (el?.open) el.close();
      prev?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="kanban-modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-[12px] bg-white p-6 text-ink shadow-[var(--shadow-card)] backdrop:bg-black/40"
    >
      <h2 id="kanban-modal-title" className="font-serif text-xl font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </dialog>
  );
}
