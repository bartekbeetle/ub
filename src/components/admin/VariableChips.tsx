"use client";

import { useCallback, useRef } from "react";

export type TemplateVar = { key: string; label: string };

type Field = HTMLInputElement | HTMLTextAreaElement;

/**
 * Wstawianie zmiennych kliknięciem: `{{klucz}}` ląduje tam, gdzie stał kursor —
 * w temacie albo w treści, zależnie od tego, które pole było ostatnio aktywne.
 * Wysyłka podstawia potem dane konkretnej osoby (`renderTemplate`).
 */
export function useVariableInsert(fields: {
  subject: { value: string; set: (v: string) => void };
  body: { value: string; set: (v: string) => void };
}) {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const last = useRef<"subject" | "body">("body");

  const insert = useCallback(
    (key: string) => {
      const which = last.current;
      const el: Field | null = which === "subject" ? subjectRef.current : bodyRef.current;
      const { value, set } = fields[which];
      const token = `{{${key}}}`;
      if (!el) return set(value + token);
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      set(value.slice(0, start) + token + value.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    },
    [fields]
  );

  return {
    insert,
    subjectProps: { ref: subjectRef, onFocus: () => (last.current = "subject") },
    bodyProps: { ref: bodyRef, onFocus: () => (last.current = "body") },
  };
}

/** Klikalne „pigułki” ze zmiennymi. Kod `{{…}}` widać w dymku i małym druczkiem. */
export function VariableChips({
  vars,
  onInsert,
  required = [],
}: {
  vars: TemplateVar[];
  onInsert: (key: string) => void;
  required?: string[];
}) {
  return (
    <div>
      <p className="mt-3 text-xs font-semibold text-muted">
        Wstaw do maila (kliknij — trafi tam, gdzie stoi kursor; wysyłka podstawi dane każdej osoby):
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {vars.map((v) => (
          <button
            key={v.key}
            type="button"
            // mousedown zabrałby fokus z pola i zgubił pozycję kursora
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsert(v.key)}
            title={`Wstawia {{${v.key}}}`}
            className={`press inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              required.includes(v.key)
                ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                : "border-sand-200 bg-sand-50 text-sand-700 hover:bg-sand-100"
            }`}
          >
            <span aria-hidden>+</span>
            {v.label}
            <span className="font-mono text-[10px] font-normal text-muted">{`{{${v.key}}}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
