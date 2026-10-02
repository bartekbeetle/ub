"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CRM_STAGES, CRM_STAGE_LABELS, type CrmStage } from "@/lib/crm-stages";

/**
 * Zmiana etapu. Etapy „Zapisana" i „Rezygnacja" zmieniają status przydziału po stronie serwera
 * (wspólna funkcja naliczająca), pozostałe to wewnętrzne doprecyzowanie bez wpływu na rozliczenia.
 * Po zapisie etap jest zablokowany: naliczona należność koryguje biuro.
 */
export function StageControl({ assignmentId, current }: { assignmentId: number; current: CrmStage }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = current === "zapisana";

  async function change(stage: CrmStage) {
    if (stage === current) return;
    let rejectionReason: string | undefined;
    if (stage === "rezygnacja") {
      rejectionReason = window.prompt("Podaj powód rezygnacji kursantki:") ?? "";
      if (!rejectionReason.trim()) return;
    }
    if (stage === "zapisana") {
      if (!window.confirm("Oznaczyć kursantkę jako ZAPISANĄ? Naliczy to rozliczenie za zapisaną kursantkę i nie da się tego cofnąć samodzielnie.")) return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/panel/crm/${assignmentId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, rejectionReason }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error ?? "Nie udało się zmienić etapu.");
  }

  return (
    <div>
      <label htmlFor="crm-stage" className="label">Etap</label>
      <select
        id="crm-stage"
        value={current}
        disabled={busy || locked}
        onChange={(e) => change(e.target.value as CrmStage)}
        className="input"
      >
        {CRM_STAGES.map((s) => (
          <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>
        ))}
      </select>
      {locked && <p className="mt-1.5 text-xs text-muted">Zapis jest naliczony. Korektę zgłoś do biura Uniwersytetu Beauty.</p>}
      {error && <p role="alert" className="field-error">{error}</p>}
    </div>
  );
}
