"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** `Date` → `"RRRR-MM-DD"` do wartości inputu `type="date"`. Format lokalny, nie ISO z godziną. */
function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/**
 * Formularz „następny ruch" na karcie prospekta — ustawia `nextActionAt` (jako `"RRRR-MM-DD"`,
 * serwer dokleja 9:00 czasu Warszawy) i `nextActionNote` przez ten sam PATCH co reszta CRM.
 */
export function ProspectNextActionForm({
  prospectId,
  nextActionAt,
  nextActionNote,
}: {
  prospectId: number;
  nextActionAt: Date | null;
  nextActionNote: string | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(toDateInputValue(nextActionAt));
  const [note, setNote] = useState(nextActionNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/prospekty/${prospectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nextActionAt: date, nextActionNote: note }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Nie udało się zapisać.");
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`next-action-date-${prospectId}`} className="block text-xs font-semibold text-muted">
          Data
        </label>
        <input
          id={`next-action-date-${prospectId}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input !py-1.5 !text-sm"
        />
      </div>
      <div className="min-w-[220px] flex-1">
        <label htmlFor={`next-action-note-${prospectId}`} className="block text-xs font-semibold text-muted">
          Notatka (np. „pyta o cenę dla 3 kursantek")
        </label>
        <input
          id={`next-action-note-${prospectId}`}
          type="text"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input !py-1.5 !text-sm"
        />
      </div>
      <button type="submit" disabled={busy} className="btn-primary !px-4 !py-2 !text-sm disabled:opacity-50">
        {busy ? "Zapisywanie…" : "Zapisz"}
      </button>
      {error && (
        <p role="alert" className="w-full text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
