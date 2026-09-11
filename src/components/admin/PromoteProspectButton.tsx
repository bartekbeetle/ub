"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PromoteProspectButton({ prospectId, name }: { prospectId: number; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function promote() {
    const ok = window.confirm(
      `Utworzyć profil trenerki dla „${name}"?\n\n` +
        "Profil powstanie jako UKRYTY (niewidoczny w katalogu) i BEZ automatycznego przydziału leadów. " +
        "Jedno i drugie włączysz ręcznie w karcie trenerki, po uzupełnieniu profilu."
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/prospekty/${prospectId}/awansuj`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.trainer?.id) router.push(`/admin/trenerki/${data.trainer.id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Nie udało się utworzyć profilu.");
    }
  }

  return (
    <div>
      <button type="button" onClick={promote} disabled={busy} className="btn-primary !px-4 !py-2 !text-sm disabled:opacity-50">
        {busy ? "Tworzenie…" : "Utwórz profil trenerki"}
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
