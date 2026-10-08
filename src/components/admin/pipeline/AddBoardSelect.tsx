"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Nowa tablica (kategoria) dla trenerki, której tablicę właśnie oglądasz. */
export function AddBoardSelect({ trainerId, trainerName, missing }: { trainerId: number; trainerName: string; missing: string[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (missing.length === 0) return null;

  async function add(category: string) {
    setError(null);
    const res = await fetch("/api/admin/crm-kursantki/tablice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainerId, category }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Nie udało się dodać tablicy.");
      return;
    }
    const data = (await res.json()) as { boardId: number };
    router.push(`/admin/crm-kursantki?tablica=${data.boardId}`);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Nowa kategoria dla {trainerName}:</span>
      <select defaultValue="" onChange={(e) => e.target.value && add(e.target.value)} className="input !w-auto !py-1 !text-sm">
        <option value="">wybierz…</option>
        {missing.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {error && <span className="text-xs font-semibold text-red-700">{error}</span>}
    </label>
  );
}
