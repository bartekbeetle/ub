"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NoteForm({ assignmentId }: { assignmentId: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/panel/crm/${assignmentId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setBusy(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else setError((await res.json().catch(() => ({}))).error ?? "Nie udało się zapisać notatki.");
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="crm-note" className="label">Nowa notatka</label>
      <textarea id="crm-note" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} className="input" placeholder="Co ustaliłyście? Co ma się wydarzyć dalej?" />
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={busy || !body.trim()} className="btn-outline !px-5 !py-2 !text-sm disabled:opacity-50">Dodaj notatkę</button>
        <span className="text-xs text-muted">Notatki widzisz tylko Ty.</span>
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
    </form>
  );
}
