"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";

export function LeadStatusSelect({ leadId, current }: { leadId: number; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(status: string) {
    let rejectionReason = "";
    if (status === "odrzucony") {
      rejectionReason = window.prompt("Powód odrzucenia:") ?? "";
      if (!rejectionReason) return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejectionReason }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Nie udało się zmienić statusu.");
  }

  return (
    <select
      value={current}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      aria-label="Zmień status leada"
      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}
