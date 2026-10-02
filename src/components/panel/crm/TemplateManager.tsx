"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ComposerTemplate } from "./Composer";

type Draft = { id: number | null; channel: "email" | "sms"; name: string; subject: string; body: string };
const EMPTY: Draft = { id: null, channel: "email", name: "", subject: "", body: "" };

export function TemplateManager({ templates }: { templates: ComposerTemplate[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    const res = await fetch(draft.id ? `/api/panel/crm/templates/${draft.id}` : "/api/panel/crm/templates", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: draft.channel, name: draft.name, subject: draft.channel === "email" ? draft.subject : null, body: draft.body }),
    });
    setBusy(false);
    if (res.ok) {
      setDraft(null);
      router.refresh();
    } else setError((await res.json().catch(() => ({}))).error ?? "Nie udało się zapisać szablonu.");
  }

  async function remove(id: number) {
    if (!window.confirm("Usunąć ten szablon?")) return;
    const res = await fetch(`/api/panel/crm/templates/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setError("Nie udało się usunąć szablonu.");
  }

  return (
    <div>
      {!draft && (
        <button type="button" className="btn-primary" onClick={() => setDraft({ ...EMPTY })}>Nowy szablon</button>
      )}

      {draft && (
        <form onSubmit={save} className="card space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">{draft.id ? "Edycja szablonu" : "Nowy szablon"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tpl-name" className="label">Nazwa</label>
              <input id="tpl-name" className="input" value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="tpl-ch" className="label">Kanał</label>
              <select id="tpl-ch" className="input" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as "email" | "sms" })}>
                <option value="email">E-mail</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>
          {draft.channel === "email" && (
            <div>
              <label htmlFor="tpl-subject" className="label">Temat</label>
              <input id="tpl-subject" className="input" value={draft.subject} maxLength={200} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </div>
          )}
          <div>
            <label htmlFor="tpl-body" className="label">Treść</label>
            <textarea id="tpl-body" rows={8} className="input" value={draft.body} maxLength={5000} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <p className="mt-1 text-xs text-muted">Znaczniki: <code>{"{imie}"}</code> (imię kursantki w wołaczu) i <code>{"{kurs}"}</code> (szkolenie, którego dotyczy zgłoszenie).</p>
          </div>
          {error && <p role="alert" className="field-error">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={busy || !draft.name.trim() || !draft.body.trim()} className="btn-primary disabled:opacity-50">Zapisz szablon</button>
            <button type="button" className="btn-outline" onClick={() => { setDraft(null); setError(null); }}>Anuluj</button>
          </div>
        </form>
      )}

      {!draft && error && <p role="alert" className="field-error">{error}</p>}

      <ul className="mt-5 space-y-3">
        {templates.map((t) => (
          <li key={t.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-ink-soft">{t.name}</span>{" "}
                <span className="badge-tag">{t.channel === "sms" ? "SMS" : "E-mail"}</span>
              </div>
              <div className="flex gap-4 text-sm">
                <button type="button" className="link-inline" onClick={() => setDraft({ id: t.id, channel: t.channel, name: t.name, subject: t.subject ?? "", body: t.body })}>Edytuj</button>
                <button type="button" className="link-inline !text-red-700" onClick={() => remove(t.id)}>Usuń</button>
              </div>
            </div>
            {t.subject && <p className="mt-2 text-sm text-ink-soft">Temat: {t.subject}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{t.body}</p>
          </li>
        ))}
        {templates.length === 0 && !draft && <li className="text-sm text-muted">Nie masz jeszcze szablonów.</li>}
      </ul>
    </div>
  );
}
