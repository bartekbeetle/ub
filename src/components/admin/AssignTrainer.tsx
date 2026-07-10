"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TrainerOption = { id: number; name: string; city: string | null };

export function AssignTrainer({ leadId, options }: { leadId: number; options: TrainerOption[] }) {
  const router = useRouter();
  const [trainerId, setTrainerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    if (!trainerId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainerId: Number(trainerId) }),
    });
    setBusy(false);
    if (res.ok) {
      setTrainerId("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Błąd przydziału.");
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)} className="input !py-2 !text-sm" aria-label="Wybierz trenerkę do przydziału">
          <option value="">Wybierz trenerkę…</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.city ? ` (${t.city})` : ""}</option>
          ))}
        </select>
        <button type="button" onClick={assign} disabled={busy || !trainerId} className="btn-primary !px-4 !py-2 !text-sm disabled:opacity-50">
          Przydziel
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function UnassignButton({ leadId, trainerId }: { leadId: number; trainerId: number }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm("Usunąć przydział tej trenerki?")) return;
        const res = await fetch(`/api/admin/leads/${leadId}/assign?trainerId=${trainerId}`, { method: "DELETE" });
        if (res.ok) router.refresh();
      }}
      className="text-xs font-semibold text-red-600 hover:underline"
    >
      Usuń
    </button>
  );
}
