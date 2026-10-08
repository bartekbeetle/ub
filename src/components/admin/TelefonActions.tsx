"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { smsLength } from "@/lib/sms/phone";

/**
 * Prawa strona zakładki „Telefon": przycisk Zadzwoń (otwiera wybieranie w telefonie),
 * wynik rozmowy jednym tapnięciem i formularz SMS. Panel ma być wygodny na telefonie,
 * na którym leży karta SIM UB — dlatego duże przyciski i `tel:`.
 */
export function TelefonActions({ phone, e164 }: { phone: string; e164: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const len = smsLength(text);

  async function post(url: string, body: unknown, key: string) {
    setBusy(key);
    setError(null);
    setInfo(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Coś poszło nie tak.");
      return false;
    }
    if (data.dryRun) setInfo("Tryb testowy: wiadomość zapisana, ale NIE wysłana (brak połączenia z telefonem).");
    router.refresh();
    return true;
  }

  async function sendSms() {
    if (await post("/api/admin/telefon/sms", { phone, text }, "sms")) setText("");
  }

  async function logCall(outcome: "odebrala" | "nieodebrala" | "oddzwonic") {
    if (await post("/api/admin/telefon/rozmowa", { phone, outcome, note }, outcome)) setNote("");
  }

  return (
    <div className="space-y-5">
      <a href={`tel:${e164}`} className="btn-money block !py-3 text-center !text-base">
        Zadzwoń
      </a>

      <div className="space-y-2">
        <p className="label">Jak poszła rozmowa?</p>
        <input
          className="input !text-sm"
          placeholder="Notatka (opcjonalnie)"
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          {([
            ["odebrala", "Odebrała"],
            ["nieodebrala", "Nie odebrała"],
            ["oddzwonic", "Oddzwonić"],
          ] as const).map(([k, label]) => (
            <button key={k} type="button" disabled={busy !== null} onClick={() => logCall(k)} className="btn-outline !px-2 !py-2 !text-sm disabled:opacity-50">
              {busy === k ? "…" : label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="label" htmlFor="tel-sms">SMS</label>
        <textarea id="tel-sms" className="input resize-y !text-sm" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-sand-500">
            {len.length} zn. · {len.segments} {len.segments === 1 ? "część" : "części"}
            {len.unicode ? " (polskie litery skracają limit do 70)" : ""}
          </span>
          <button type="button" onClick={sendSms} disabled={busy !== null || !text.trim()} className="btn-primary !px-5 !py-2 !text-sm disabled:opacity-50">
            {busy === "sms" ? "Wysyłam…" : "Wyślij SMS"}
          </button>
        </div>
      </div>

      {info && <p role="status" className="text-sm font-medium text-amber-800">{info}</p>}
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
