"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CALLBACK_OPTIONS = [
  { value: 1, label: "jutro" },
  { value: 3, label: "za 3 dni" },
  { value: 7, label: "za 7 dni" },
] as const;

/**
 * Trzy szybkie akcje z bloku „Do zadzwonienia" — każda to jeden ruch myszką, bez otwierania
 * karty prospekta. Wzorowane na `ProspectStatusSelect`: client component → PATCH → `router.refresh()`.
 */
export function ProspectQuickActions({ prospectId }: { prospectId: number }) {
  const router = useRouter();
  const [days, setDays] = useState<1 | 3 | 7>(3);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    const res = await fetch(`/api/admin/prospekty/${prospectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Nie udało się zapisać.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white pl-2 pr-1 py-1">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value) as 1 | 3 | 7)}
          aria-label="Za ile dni oddzwonić"
          className="bg-transparent text-xs font-semibold text-ink-soft focus:outline-none"
        >
          {CALLBACK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run({ quickAction: "dzwonilem", days }, "dzwonilem")}
          className="rounded-md bg-money-bg px-2 py-1 text-xs font-bold text-money-dark hover:bg-money-bg/70 disabled:opacity-50"
        >
          Dzwoniłem
        </button>
      </div>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => run({ quickAction: "nie_odbiera" }, "nie_odbiera")}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-gray-50 disabled:opacity-50"
      >
        Nie odbiera
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => run({ quickAction: "odloz" }, "odloz")}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-gray-50 disabled:opacity-50"
      >
        Odłóż (+14 dni)
      </button>
      {error && <p role="alert" className="w-full text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
