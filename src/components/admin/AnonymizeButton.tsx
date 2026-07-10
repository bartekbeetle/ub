"use client";

import { useRouter } from "next/navigation";

export function AnonymizeButton({ leadId }: { leadId: number }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm("Trwale zanonimizować dane osobowe tego leada (RODO)? Tej operacji nie można cofnąć.")) return;
        const res = await fetch(`/api/admin/leads/${leadId}/anonymize`, { method: "POST" });
        if (res.ok) router.refresh();
        else alert("Nie udało się zanonimizować.");
      }}
      className="rounded-full border-2 border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
    >
      Anonimizuj dane (RODO)
    </button>
  );
}
