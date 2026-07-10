"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PanelPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const newPassword = String(fd.get("newPassword"));
    if (newPassword !== String(fd.get("confirm"))) {
      setError("Hasła nie są identyczne.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/panel/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: String(fd.get("currentPassword")), newPassword }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/panel/leady");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Błąd zmiany hasła.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <div>
        <label className="label" htmlFor="p-current">Obecne hasło</label>
        <input id="p-current" name="currentPassword" type="password" required autoComplete="current-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="p-new">Nowe hasło (min. 10 znaków)</label>
        <input id="p-new" name="newPassword" type="password" required minLength={10} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="p-confirm">Powtórz nowe hasło</label>
        <input id="p-confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input" />
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
        {busy ? "Zapisywanie…" : "Zmień hasło"}
      </button>
    </form>
  );
}
