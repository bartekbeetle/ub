"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeadNotes({ leadId, initial }: { leadId: number; initial: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  return (
    <div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        className="input resize-y !text-sm"
        placeholder="Notatki wewnętrzne o leadzie…"
        aria-label="Notatki"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={state === "saving"}
          onClick={async () => {
            setState("saving");
            const res = await fetch(`/api/admin/leads/${leadId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes }),
            });
            setState(res.ok ? "saved" : "idle");
            if (res.ok) router.refresh();
          }}
          className="btn-primary !px-4 !py-2 !text-sm disabled:opacity-50"
        >
          Zapisz notatki
        </button>
        {state === "saved" && <span className="text-xs font-semibold text-money-dark">Zapisano</span>}
      </div>
    </div>
  );
}
