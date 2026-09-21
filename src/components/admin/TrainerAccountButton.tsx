"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = { email: string; password: string; created: boolean };

/**
 * Utworzenie konta do panelu albo reset hasła — z hasłem wyświetlonym na ekranie.
 * Dyktujemy je przez telefon, bo maila resetującego nie ma jak wysłać (brak SMTP).
 * Hasło pokazuje się RAZ: po odświeżeniu strony nie da się go odczytać ponownie,
 * bo w bazie leży wyłącznie hash.
 */
export function TrainerAccountButton({
  trainerId,
  hasAccount,
  accountEmail,
  trainerEmail,
}: {
  trainerId: number;
  hasAccount: boolean;
  accountEmail: string | null;
  trainerEmail: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const ok = window.confirm(
      hasAccount
        ? `Zresetować hasło konta ${accountEmail}?\n\nStare hasło przestanie działać, a trenerka zostanie wylogowana ze wszystkich urządzeń. Nowe hasło zobaczysz na ekranie — podyktuj je przez telefon.`
        : "Utworzyć konto do panelu dla tej trenerki?\n\nHasło startowe zobaczysz na ekranie. Przy pierwszym logowaniu trenerka będzie musiała ustawić własne."
    );
    if (!ok) return;

    let email = trainerEmail ?? "";
    if (!hasAccount && !email) {
      const typed = window.prompt("Podaj adres e-mail, którym trenerka będzie się logować:");
      if (!typed) return;
      email = typed;
    }

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/trenerki/${trainerId}/konto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setResult(data as Result);
      router.refresh();
    } else {
      setError(data.error ?? "Nie udało się wykonać operacji.");
    }
  }

  return (
    <div>
      <button type="button" onClick={run} disabled={busy} className="btn-outline !px-4 !py-2 !text-sm disabled:opacity-50">
        {busy ? "Pracuję…" : hasAccount ? "Zresetuj hasło" : "Utwórz konto do panelu"}
      </button>

      {result && (
        <div className="mt-3 rounded-[12px] border border-amber-300 bg-amber-50 p-4 text-sm" role="status">
          <p className="font-semibold text-amber-900">
            {result.created ? "Konto utworzone." : "Hasło zresetowane."} Zapisz teraz — nie pokażemy go drugi raz.
          </p>
          <dl className="mt-2 grid grid-cols-[80px_1fr] gap-y-1">
            <dt className="text-amber-900/70">Login</dt>
            <dd className="font-mono break-all">{result.email}</dd>
            <dt className="text-amber-900/70">Hasło</dt>
            <dd className="font-mono break-all select-all">{result.password}</dd>
          </dl>
          <p className="mt-2 text-xs text-amber-900/80">
            Trenerka ustawi własne hasło przy pierwszym logowaniu — do tego czasu panel nie pokaże jej żadnych danych
            kursantek.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
