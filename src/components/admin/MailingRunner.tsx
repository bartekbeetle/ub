"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stats = {
  total: number;
  oczekuje: number;
  wKolejce: number;
  pominiety: number;
  blad: number;
  doreczone: number;
};

/**
 * Uruchamianie kampanii: zamrożenie listy → wysyłka partiami → liczniki.
 *
 * Pętla po partiach siedzi po stronie przeglądarki celowo. Wysyłka kilkuset maili przez
 * SMTP trwa minuty i jedno długie żądanie padłoby na limicie czasu, zostawiając kampanię
 * w stanie, o którym nic nie wiadomo. Tutaj każda partia zapisuje wynik od razu,
 * więc zamknięcie karty w połowie niczego nie psuje — wystarczy kliknąć dalej.
 */
export function MailingRunner({
  campaignId,
  status,
  initialStats,
  smtpReady,
  subject,
  body,
}: {
  campaignId: number;
  status: string;
  initialStats: Stats;
  smtpReady: boolean;
  subject: string;
  body: string;
}) {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(initialStats);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [frozen, setFrozen] = useState(status !== "szkic");
  const [finished, setFinished] = useState(status === "zakonczona");

  async function onPrepare() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/mailing/${campaignId}/przygotuj`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Nie udało się przygotować listy.");
    setStats(data.stats);
    setFrozen(true);
    setNote(`Lista zamrożona: ${data.recipients} odbiorców. Nic jeszcze nie wyszło.`);
    router.refresh();
  }

  async function onSend() {
    setBusy(true);
    setError(null);
    setNote(null);
    // Pętla partiami aż do końca listy; zabezpieczenie licznikiem na wypadek,
    // gdyby serwer uparcie zwracał „jeszcze nie koniec".
    for (let i = 0; i < 400; i++) {
      const res = await fetch(`/api/admin/mailing/${campaignId}/wyslij?batch=25`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Wysyłka przerwana.");
        break;
      }
      setStats(data.stats);
      if (data.done) {
        setFinished(true);
        break;
      }
    }
    setBusy(false);
    router.refresh();
  }

  async function onTest() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await fetch("/api/admin/mailing/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testTo, subject, body }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok && data.ok) setNote(`Wiadomość testowa wysłana na ${testTo}.`);
    else setError(data.error ?? "Nie udało się wysłać wiadomości testowej.");
  }

  return (
    <div className="card mt-6 p-6">
      <h2 className="font-serif text-lg font-semibold">Wysyłka</h2>

      {!smtpReady && (
        <div className="mt-3 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Brak konfiguracji SMTP — wiadomości trafią do kolejki i wyjdą dopiero po jej
          uzupełnieniu. Wysyłka próbna jest w tym stanie zablokowana, bo niczego by nie
          sprawdziła.
        </div>
      )}

      {frozen && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Odbiorcy", stats.total],
            ["Doręczone", stats.doreczone],
            ["W kolejce", stats.wKolejce],
            ["Oczekuje", stats.oczekuje],
            ["Pominięte / błąd", stats.pominiety + stats.blad],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-[10px] bg-gray-50 px-3 py-2">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-lg font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {frozen && (
        <p className="mt-2 text-xs text-muted">
          „Doręczone" liczymy z kolejki maili — po statusie nadanym przez serwer pocztowy,
          a nie po tym, że wysyłka się przemieliła. Dlatego przy braku SMTP ta liczba
          zostaje na zerze, choć odbiorcy są przetworzeni.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!frozen ? (
          <button type="button" className="btn-primary" onClick={onPrepare} disabled={busy}>
            {busy ? "Przygotowuję…" : "Przygotuj wysyłkę (zamroź listę)"}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={onSend}
            disabled={busy || stats.oczekuje === 0}
          >
            {busy
              ? "Wysyłam…"
              : stats.oczekuje === 0
                ? finished
                  ? "Wszyscy przetworzeni"
                  : "Brak oczekujących"
                : `Wyślij do ${stats.oczekuje} osób`}
          </button>
        )}

        <div className="flex items-center gap-2">
          <input
            type="email"
            className="input w-56"
            placeholder="adres do testu"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button
            type="button"
            className="btn-outline"
            onClick={onTest}
            disabled={busy || !testTo || !smtpReady}
          >
            Wyślij próbnie
          </button>
        </div>
      </div>

      {note && <p className="mt-3 text-sm font-semibold text-green-800">{note}</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {!frozen && (
        <p className="mt-3 text-xs text-muted">
          Zamrożenie listy zapisuje, do kogo ta kampania ma pójść. Od tego momentu treści
          nie da się już zmienić — inaczej dwie osoby z jednej wysyłki dostałyby dwie różne
          wiadomości.
        </p>
      )}
    </div>
  );
}
