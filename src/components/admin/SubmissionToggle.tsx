"use client";

import { useRouter } from "next/navigation";

export function SubmissionToggle({ id, isHandled }: { id: number; isHandled: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        const res = await fetch(`/api/admin/zgloszenia/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isHandled: !isHandled }),
        });
        if (res.ok) router.refresh();
      }}
      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
        isHandled ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-amber-100 text-amber-800 hover:bg-amber-200"
      }`}
    >
      {isHandled ? "Obsłużone" : "Nowe → oznacz"}
    </button>
  );
}
