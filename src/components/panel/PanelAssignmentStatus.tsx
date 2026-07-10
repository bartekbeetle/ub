"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = [
  { value: "przydzielony", label: "Przydzielony" },
  { value: "skontaktowany", label: "Skontaktowany" },
  { value: "zapisana", label: "Zapisana" },
  { value: "odrzucony", label: "Odrzucony" },
];

export function PanelAssignmentStatus({ assignmentId, current }: { assignmentId: number; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(status: string) {
    let rejectionReason = "";
    if (status === "odrzucony") {
      rejectionReason = window.prompt("Podaj powód odrzucenia leada:") ?? "";
      if (!rejectionReason.trim()) return;
    }
    if (status === "zapisana") {
      if (!window.confirm("Oznaczyć lead jako ZAPISANA? To naliczy rozliczenie za zapisaną kursantkę.")) return;
    }
    setBusy(true);
    const res = await fetch(`/api/panel/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejectionReason }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Nie udało się zmienić statusu.");
    }
  }

  return (
    <select
      value={current}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      aria-label="Status leada"
      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}
