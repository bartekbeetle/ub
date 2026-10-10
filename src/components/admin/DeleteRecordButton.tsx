"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Trwałe usunięcie rekordu (kursantka, zgłoszenie, prospekt z CRM trenerek) — rekordy testowe i śmieciowe.
 *
 * Potwierdzenie jest dwustopniowe i inline, celowo BEZ `window.confirm`: modal przeglądarki
 * blokuje stronę i odklikuje się odruchowo, a tu kasujemy nieodwracalnie.
 */
export function DeleteRecordButton({
  id,
  kind,
  name,
  redirectTo,
}: {
  id: number;
  kind: "lead" | "zgloszenie" | "prospekt" | "porzucona";
  name: string;
  /** Po usunięciu przejdź tutaj zamiast odświeżać (np. z karty, która właśnie przestała istnieć). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint =
    kind === "lead"
      ? `/api/admin/leads/${id}`
      : kind === "prospekt"
        ? `/api/admin/prospekty/${id}`
        : kind === "porzucona"
          ? `/api/admin/porzucone/${id}`
          : `/api/admin/zgloszenia/${id}`;

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, { method: "DELETE" });
    if (res.ok) {
      if (redirectTo) router.push(redirectTo);
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.error ?? "Nie udało się usunąć rekordu.");
    setBusy(false);
    setArmed(false);
  }

  if (error) {
    return (
      <div className="mt-1 text-[11px] text-red-700">
        {error}{" "}
        <button type="button" onClick={() => setError(null)} className="underline">
          ukryj
        </button>
      </div>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={`Usuń rekord: ${name}`}
        className="mt-1 text-[11px] text-muted underline decoration-dotted underline-offset-2 hover:text-red-700"
      >
        Usuń
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2 text-[11px]">
      <span className="font-semibold text-red-700">Usunąć na stałe?</span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded bg-red-600 px-2 py-0.5 font-bold text-white disabled:opacity-50"
      >
        {busy ? "Usuwam…" : "Tak, usuń"}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        disabled={busy}
        className="text-muted underline"
      >
        Anuluj
      </button>
    </div>
  );
}
