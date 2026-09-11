"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROSPECT_STATUSES, PROSPECT_STATUS_LABELS } from "@/lib/constants";

export function ProspectStatusSelect({
  prospectId,
  current,
  label = "Zmień status prospekta",
}: {
  prospectId: number;
  current: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(status: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/prospekty/${prospectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Nie udało się zmienić statusu.");
    }
  }

  return (
    <div>
      <select
        value={current}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        aria-label={label}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {PROSPECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROSPECT_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
