"use client";

import { useEffect, useRef, useState } from "react";
import { LeadForm } from "./LeadForm";
import { IconX } from "./icons";

type Props = {
  courseId: number;
  category: string;
  voivodeship?: string | null;
  buttonLabel?: string;
  buttonClass?: string;
};

export function LeadFormModal({ courseId, category, voivodeship, buttonLabel = "Aplikuj o dofinansowanie", buttonClass = "btn-primary w-full" }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-[calc(100vw-2rem)] max-w-lg rounded-[16px] p-0 shadow-2xl backdrop:bg-ink-soft/50 backdrop:backdrop-blur-sm"
        aria-label="Formularz zgłoszeniowy"
      >
        <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-bold md:text-2xl">Aplikuj o dofinansowanie</h2>
              <p className="mt-1 text-sm text-muted">
                Wypełnij formularz — sprawdzimy Twoje dofinansowanie i połączymy Cię z trenerką.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zamknij formularz"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sand-50"
            >
              <IconX />
            </button>
          </div>
          <LeadForm courseId={courseId} defaultCategory={category} defaultVoivodeship={voivodeship ?? undefined} source="kurs" />
        </div>
      </dialog>
    </>
  );
}
