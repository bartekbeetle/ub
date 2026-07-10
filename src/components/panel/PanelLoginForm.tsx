"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PanelLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/panel/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(fd.get("email")), password: String(fd.get("password")) }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res || !res.ok) {
      setError(data?.error ?? "Błąd logowania.");
      setSending(false);
      return;
    }
    router.push(data.mustChangePassword ? "/panel/haslo" : "/panel/leady");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="login-email">Email</label>
        <input id="login-email" name="email" type="email" required autoComplete="username" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="login-pass">Hasło</label>
        <input id="login-pass" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
      )}
      <button type="submit" disabled={sending} className="btn-primary w-full disabled:opacity-60">
        {sending ? "Logowanie..." : "Zaloguj się"}
      </button>
    </form>
  );
}
