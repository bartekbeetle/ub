"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/constants";

/** Kategorie dodatkowe kursantki — inne kursy, o które pytała. Główna (z formularza) jest nieedytowalna. */
export function LeadExtraCategories({ leadId, main, initial }: { leadId: number; main: string; initial: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = [...picked].sort().join("|") !== [...initial].sort().join("|");

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.filter((c) => c !== main).map((c) => {
          const on = picked.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setState("idle");
                setPicked(on ? picked.filter((x) => x !== c) : [...picked, c]);
              }}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                on ? "border-sand-600 bg-sand-600 text-white" : "border-gray-200 bg-white text-ink-soft hover:bg-gray-50"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      {(dirty || state !== "idle") && (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={!dirty || state === "saving"}
            onClick={async () => {
              setState("saving");
              const res = await fetch(`/api/admin/leads/${leadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ extraCategories: picked }),
              });
              setState(res.ok ? "saved" : "error");
              if (res.ok) router.refresh();
            }}
            className="btn-primary !px-3 !py-1.5 !text-xs disabled:opacity-50"
          >
            Zapisz kategorie
          </button>
          {state === "saved" && <span role="status" className="text-xs font-semibold text-money-dark">Zapisano</span>}
          {state === "error" && <span role="alert" className="text-xs font-semibold text-red-700">Nie udało się zapisać.</span>}
        </div>
      )}
    </div>
  );
}
