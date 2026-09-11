"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROSPECT_ACTIVITY_LABELS } from "@/lib/constants";

// „zmiana_statusu" wypada z listy — to wpis generowany przez system, nie coś, co admin dopisuje ręcznie.
const TYPES = ["notatka", "telefon", "email", "spotkanie"] as const;

export function ProspectActivityForm({ prospectId }: { prospectId: number }) {
  const router = useRouter();
  const [type, setType] = useState<string>("notatka");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/prospekty/${prospectId}/aktywnosci`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content }),
    });
    setBusy(false);
    if (res.ok) {
      setContent("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Nie udało się zapisać wpisu.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <label
            key={t}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              type === t ? "border-sand-600 bg-sand-100 text-ink-soft" : "border-gray-200 text-muted hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="typ-aktywnosci"
              value={t}
              checked={type === t}
              onChange={() => setType(t)}
              className="sr-only"
            />
            {PROSPECT_ACTIVITY_LABELS[t]}
          </label>
        ))}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Co się wydarzyło? (np. rozmowa z właścicielką, ustalenia, następny krok)"
        aria-label="Treść wpisu"
        className="input resize-y !text-sm"
      />
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !content.trim()} className="btn-primary !px-4 !py-2 !text-sm disabled:opacity-50">
        {busy ? "Zapisywanie…" : "Dodaj wpis"}
      </button>
    </form>
  );
}
