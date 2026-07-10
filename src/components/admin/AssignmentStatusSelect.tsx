"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = [
  { value: "przydzielony", label: "Przydzielony" },
  { value: "skontaktowany", label: "Skontaktowany" },
  { value: "zapisana", label: "Zapisana" },
  { value: "odrzucony", label: "Odrzucony" },
];

export function AssignmentStatusSelect({ assignmentId, current }: { assignmentId: number; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(status: string) {
    let rejectionReason = "";
    if (status === "odrzucony") {
      rejectionReason = window.prompt("Powód odrzucenia:") ?? "";
      if (!rejectionReason) return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejectionReason }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Nie udało się zmienić statusu przydziału.");
  }

  return (
    <select
      value={current}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      aria-label="Status przydziału"
      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}

export function BillingStatusSelect({ assignmentId, current }: { assignmentId: number; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <select
      value={current}
      disabled={busy}
      onChange={async (e) => {
        setBusy(true);
        const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billingStatus: e.target.value }),
        });
        setBusy(false);
        if (res.ok) router.refresh();
      }}
      aria-label="Status płatności"
      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
    >
      <option value="do_zafakturowania">Do zafakturowania</option>
      <option value="zafakturowane">Zafakturowane</option>
      <option value="oplacone">Opłacone</option>
    </select>
  );
}
