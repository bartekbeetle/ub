"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { smsLength, SMS_MAX_SEGMENTS } from "@/lib/sms/phone";
import { renderCrmTemplate } from "@/lib/crm-stages";

export type ComposerTemplate = { id: number; channel: "email" | "sms"; name: string; subject: string | null; body: string };

type Props = {
  assignmentId: number;
  /** Tylko to, czego potrzebuje podgląd znaczników. Cały wiersz leada nie trafia do przeglądarki. */
  vars: { imie: string; kurs: string };
  canEmail: boolean;
  canSms: boolean;
  /** Powód zablokowania SMS (brak zgody, brak numeru). */
  smsBlockedReason: string | null;
  smsLive: boolean;
  templates: ComposerTemplate[];
  usage: { email: number; emailLimit: number; sms: number; smsLimit: number };
};

/** Jedna wiadomość do jednej kursantki. Wysyłki do wielu osób naraz celowo nie ma. */
export function Composer({ assignmentId, vars, canEmail, canSms, smsBlockedReason, smsLive, templates, usage }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"email" | "sms">(canEmail ? "email" : "sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sms, setSms] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const list = templates.filter((t) => t.channel === tab);
  const len = smsLength(renderCrmTemplate(sms, vars));

  function applyTemplate(id: string) {
    const t = templates.find((x) => String(x.id) === id);
    if (!t) return;
    if (t.channel === "email") {
      setSubject(t.subject ?? "");
      setBody(t.body);
    } else setSms(t.body);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/panel/crm/${assignmentId}/${tab}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tab === "email" ? { subject, body } : { text: sms }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({
        ok: true,
        text:
          tab === "sms" && data.status === "dry-run"
            ? "SMS zapisany w historii w trybie testowym. Nie został wysłany."
            : tab === "email" && data.status === "w_kolejce"
              ? "Wiadomość przyjęta i czeka w kolejce wysyłki."
              : "Wiadomość wysłana.",
      });
      if (tab === "email") {
        setSubject("");
        setBody("");
      } else setSms("");
      router.refresh();
    } else setMsg({ ok: false, text: data.error ?? "Nie udało się wysłać." });
  }

  const tabBtn = (t: "email" | "sms", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => {
        setTab(t);
        setMsg(null);
      }}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold min-h-[36px] ${tab === t ? "bg-sand-700 text-white" : "border border-sand-600 text-sand-700 hover:bg-sand-50"}`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={send}>
      <div role="tablist" aria-label="Kanał wiadomości" className="flex gap-2">
        {tabBtn("email", "E-mail")}
        {tabBtn("sms", "SMS")}
      </div>

      {list.length > 0 && (
        <div className="mt-4">
          <label htmlFor="crm-tpl" className="label">Szablon</label>
          <select id="crm-tpl" className="input" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">Bez szablonu</option>
            {list.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {tab === "email" ? (
        canEmail ? (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="crm-subject" className="label">Temat</label>
              <input id="crm-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="input" />
            </div>
            <div>
              <label htmlFor="crm-body" className="label">Treść</label>
              <textarea id="crm-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} className="input" />
              <p className="mt-1 text-xs text-muted">
                Znaczniki: <code>{"{imie}"}</code> (np. „{vars.imie}”) i <code>{"{kurs}"}</code> (np. „{vars.kurs}”). Wiadomość wyjdzie od „Twoja akademia przez Uniwersytet Beauty”, a odpowiedź kursantki trafi na adres Twojego konta.
              </p>
            </div>
            <p className="text-xs text-muted">Dziś wysłano {usage.email} z {usage.emailLimit} wiadomości e-mail.</p>
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-muted">Brak adresu e-mail do tej kursantki.</p>
        )
      ) : canSms ? (
        <div className="mt-4 space-y-3">
          {!smsLive && (
            <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">
              SMS w trybie testowym, nie wysłano. Wiadomość zapisze się w historii, ale nie dotrze do kursantki.
            </p>
          )}
          <div>
            <label htmlFor="crm-sms" className="label">Treść SMS</label>
            <textarea id="crm-sms" rows={4} value={sms} onChange={(e) => setSms(e.target.value)} maxLength={1000} className="input" />
            <p className={`mt-1 text-xs ${len.segments > SMS_MAX_SEGMENTS ? "font-semibold text-red-700" : "text-muted"}`} aria-live="polite">
              {len.length} znaków, {len.segments} {len.segments === 1 ? "część" : "części"} (limit {len.perSegment} znaków na część{len.unicode ? ", polskie litery skracają limit" : ""}). Maksymalnie {SMS_MAX_SEGMENTS} części.
            </p>
            <p className="mt-1 text-xs text-muted">Nadawca widnieje jako Uniwersytet Beauty, więc podpisz się nazwą akademii. Znaczniki: <code>{"{imie}"}</code>, <code>{"{kurs}"}</code>.</p>
          </div>
          <p className="text-xs text-muted">Dziś wysłano {usage.sms} z {usage.smsLimit} SMS-ów.</p>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{smsBlockedReason ?? "SMS jest niedostępny."}</p>
      )}

      {msg && (
        <p role="alert" className={`mt-3 rounded-lg px-4 py-3 text-sm font-medium ${msg.ok ? "bg-money-bg text-money-dark" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      {((tab === "email" && canEmail) || (tab === "sms" && canSms)) && (
        <button
          type="submit"
          disabled={busy || (tab === "email" ? !subject.trim() || !body.trim() : !sms.trim() || len.segments > SMS_MAX_SEGMENTS)}
          className="btn-primary mt-4 disabled:opacity-50"
        >
          {busy ? "Wysyłanie..." : tab === "email" ? "Wyślij e-mail" : "Wyślij SMS"}
        </button>
      )}
    </form>
  );
}
