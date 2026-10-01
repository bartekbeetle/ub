"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Formularz wysyłki z `biuro@`. Wspólny dla odpowiedzi (z `replyToUid`) i nowej wiadomości.
 * Po wysłaniu wraca na listę, żeby od razu było widać, co jeszcze czeka.
 */
export function InboxComposer({
  to: initialTo,
  subject: initialSubject,
  text: initialText,
  replyToUid,
  backHref,
}: {
  to: string;
  subject: string;
  text: string;
  replyToUid?: number;
  backHref: string;
}) {
  const router = useRouter();
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [text, setText] = useState(initialText);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSend() {
    setState("sending");
    setError(null);
    const res = await fetch("/api/admin/skrzynka/wyslij", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, text, replyToUid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("idle");
      setError(data.error ?? "Nie udało się wysłać.");
      return;
    }
    setState("sent");
    router.push(backHref);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="inbox-to">Do</label>
        <input id="inbox-to" className="input !text-sm" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="inbox-subject">Temat</label>
        <input id="inbox-subject" className="input !text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="inbox-text">Treść</label>
        <textarea
          id="inbox-text"
          className="input resize-y font-mono !text-sm"
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSend}
          disabled={state !== "idle" || !to || !subject || !text.trim()}
          className="btn-primary !px-5 !py-2 !text-sm disabled:opacity-50"
        >
          {state === "sending" ? "Wysyłam…" : "Wyślij z biuro@"}
        </button>
        {state === "sent" && <span role="status" className="text-xs font-semibold text-money-dark">Wysłano</span>}
        {error && <span role="alert" className="text-sm font-medium text-red-700">{error}</span>}
      </div>
    </div>
  );
}
