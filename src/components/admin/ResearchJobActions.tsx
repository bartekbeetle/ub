"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchJobActions({ jobId, status }: { jobId: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: string, askNotes = false) {
    let resultNotes = "";
    if (askNotes) {
      resultNotes = window.prompt("Krótko: dlaczego pomijamy ten research?") ?? "";
      if (!resultNotes) return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/research-jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, resultNotes }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Nie udało się zmienić statusu zadania.");
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs font-semibold">
      {status !== "w_toku" && status === "pending" && (
        <button type="button" disabled={busy} onClick={() => setStatus("w_toku")} className="text-sand-700 hover:underline disabled:opacity-50">
          Wezmę to
        </button>
      )}
      {status !== "gotowe" && (
        <button type="button" disabled={busy} onClick={() => setStatus("gotowe")} className="text-money-dark hover:underline disabled:opacity-50">
          Gotowe
        </button>
      )}
      {status !== "pominiete" && (
        <button type="button" disabled={busy} onClick={() => setStatus("pominiete", true)} className="text-muted hover:underline disabled:opacity-50">
          Pomiń
        </button>
      )}
      {(status === "gotowe" || status === "pominiete") && (
        <button type="button" disabled={busy} onClick={() => setStatus("pending")} className="text-muted hover:underline disabled:opacity-50">
          Przywróć
        </button>
      )}
    </div>
  );
}
