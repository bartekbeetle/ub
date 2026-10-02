"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReminderForm({ assignmentId, current }: { assignmentId: number; current: string | null }) {
  const router = useRouter();
  const [date, setDate] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string | null) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/panel/crm/${assignmentId}/reminder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: value }),
    });
    setBusy(false);
    if (res.ok) {
      if (value === null) setDate("");
      router.refresh();
    } else setError((await res.json().catch(() => ({}))).error ?? "Nie udało się zapisać daty.");
  }

  return (
    <div>
      <label htmlFor="crm-reminder" className="label">Następny kontakt</label>
      <div className="flex flex-wrap gap-2">
        <input id="crm-reminder" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input max-w-[200px]" />
        <button type="button" disabled={busy || !date || date === current} onClick={() => save(date)} className="btn-outline !px-5 !py-2 !text-sm disabled:opacity-50">
          Zapisz
        </button>
        {current && (
          <button type="button" disabled={busy} onClick={() => save(null)} className="link-inline text-sm disabled:opacity-50">
            Usuń
          </button>
        )}
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
    </div>
  );
}
