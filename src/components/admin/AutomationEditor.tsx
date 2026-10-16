"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { renderTemplate } from "@/lib/template";
import { Switch } from "@/components/ui/Switch";
import { Toast } from "@/components/ui/Toast";
import { VariableChips, useVariableInsert } from "@/components/admin/VariableChips";

type State = { subject: string; body: string; enabled: boolean; customized: boolean };

/**
 * Edytor automatu: treść po lewej, podgląd na żywo po prawej (przykładowe dane podstawione
 * tak, jak zrobi to wysyłka). Zapis działa od następnego maila — bez deployu.
 */
export function AutomationEditor({
  automationKey,
  initial,
  placeholders,
  required,
  sample,
  canReset,
  offWarning,
  defaultTestTo,
}: {
  automationKey: string;
  initial: State;
  placeholders: { key: string; label: string }[];
  required: string[];
  sample: Record<string, string>;
  canReset: boolean;
  offWarning: string;
  defaultTestTo: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [testTo, setTestTo] = useState(defaultTestTo);
  const clearToast = useCallback(() => setToast(null), []);

  const dirty = subject !== saved.subject || body !== saved.body;
  const missing = required.filter((k) => !`${subject}\n${body}`.includes(`{{${k}}}`));
  const preview = useMemo(
    () => ({ subject: renderTemplate(subject, sample), body: renderTemplate(body, sample) }),
    [subject, body, sample]
  );

  async function patch(data: Record<string, unknown>): Promise<State | null> {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/automatyzacje/${automationKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Nie udało się zapisać.");
      return null;
    }
    return json.automation as State;
  }

  async function save() {
    const next = await patch({ subject, body });
    if (!next) return;
    setSaved(next);
    setToast("Zapisane — działa od następnego maila");
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
    router.refresh();
  }

  async function reset() {
    const next = await patch({ reset: true });
    if (!next) return;
    setSaved(next);
    setSubject(next.subject);
    setBody(next.body);
    setToast("Przywrócono treść domyślną");
    router.refresh();
  }

  async function toggle(next: boolean) {
    if (!next && !confirmOff) {
      setConfirmOff(true);
      return;
    }
    setConfirmOff(false);
    setEnabled(next);
    if (!(await patch({ enabled: next }))) {
      setEnabled(!next);
      return;
    }
    setToast(next ? "Automat włączony" : "Automat wyłączony");
    router.refresh();
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/automatyzacje/${automationKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testTo, subject, body }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setToast(`Test wysłany na ${testTo}`);
    else setError(json.error ?? "Nie udało się wysłać testu.");
  }

  const fields = useMemo(
    () => ({ subject: { value: subject, set: setSubject }, body: { value: body, set: setBody } }),
    [subject, body]
  );
  const { insert, subjectProps, bodyProps } = useVariableInsert(fields);

  return (
    <>
      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{enabled ? "Automat jest włączony" : "Automat jest wyłączony"}</p>
            <p className="text-xs text-muted">{enabled ? "Maile wychodzą same po zdarzeniu." : "Nic nie wychodzi, dopóki go nie włączysz."}</p>
          </div>
          <Switch checked={enabled} onChange={toggle} disabled={busy} label="Włącz lub wyłącz automat" />
        </div>
        {confirmOff && (
          <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p><strong>Na pewno wyłączyć?</strong> {offWarning}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="press btn-primary !px-4 !py-1.5 !text-sm" onClick={() => toggle(false)}>Wyłącz</button>
              <button type="button" className="press rounded-full px-4 py-1.5 text-sm font-semibold text-sand-700 hover:bg-sand-100" onClick={() => setConfirmOff(false)}>Anuluj</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="card p-6">
          <h3 className="font-serif text-lg font-semibold">Treść</h3>
          <label className="label mt-4" htmlFor="a-subject">Temat</label>
          <input id="a-subject" {...subjectProps} className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          {subject !== saved.subject && (
            <p className="mt-1 text-xs text-muted">było: {saved.subject}</p>
          )}

          <label className="label mt-4" htmlFor="a-body">Wiadomość</label>
          <textarea
            id="a-body"
            {...bodyProps}
            rows={16}
            className="input resize-y font-mono text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          <VariableChips vars={placeholders} onInsert={insert} required={required} />

          {missing.length > 0 && (
            <p className="mt-3 text-sm text-red-700">
              Brakuje obowiązkowych pól: {missing.map((m) => `{{${m}}}`).join(", ")}.
            </p>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" className="press btn-primary !px-5 !py-2 !text-sm" disabled={!dirty || busy || missing.length > 0} onClick={save}>
              Zapisz
            </button>
            {dirty && (
              <button type="button" className="press rounded-full px-4 py-2 text-sm font-semibold text-sand-700 hover:bg-sand-100" onClick={() => { setSubject(saved.subject); setBody(saved.body); }}>
                Cofnij zmiany
              </button>
            )}
            {canReset && saved.customized && !dirty && (
              <button type="button" className="press rounded-full px-4 py-2 text-sm font-semibold text-sand-700 hover:bg-sand-100" disabled={busy} onClick={reset}>
                Przywróć domyślną
              </button>
            )}
          </div>
        </div>

        <div className="card p-6 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg font-semibold">Podgląd</h3>
            {dirty && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">niezapisane</span>}
          </div>
          <p className="mt-1 text-xs text-muted">Z przykładowymi danymi — dokładnie tak podstawi je wysyłka.</p>
          <div className={`mt-4 rounded-xl border border-gray-200 bg-white transition-shadow duration-500 ${flash ? "ring-2 ring-emerald-400" : ""}`}>
            <div className="border-b border-gray-100 px-4 py-3 text-sm">
              <p className="text-xs text-muted">Od: Uniwersytet Beauty &lt;szkolenia@uniwersytetbeauty.pl&gt;</p>
              <p className="mt-1 font-semibold">{preview.subject || "(bez tematu)"}</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed">{preview.body}</div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <label className="label" htmlFor="a-test">Wyślij próbny mail (z treścią z edytora)</label>
            <div className="flex gap-2">
              <input id="a-test" type="email" className="input" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <button type="button" className="press btn-primary shrink-0 !px-4 !py-2 !text-sm" disabled={busy || !testTo} onClick={sendTest}>
                Wyślij test
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
