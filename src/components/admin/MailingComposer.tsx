"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, VOIVODESHIPS } from "@/lib/constants";

type Segment = {
  sources: ("lead" | "aplikacja")[];
  categories: string[];
  voivodeships: string[];
  since: string;
};

type Audience = {
  total: number;
  unsubscribed: number;
  sample: { email: string; name: string | null; sourceKind: string; category: string | null }[];
};

const EMPTY: Segment = { sources: [], categories: [], voivodeships: [], since: "" };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Tworzenie kampanii: treść + segment + licznik odbiorców na żywo.
 *
 * Licznik jest tu celowo, a nie dopiero po zapisaniu: bez niego admin pisze wiadomość
 * do listy, której rozmiaru nie zna, i dowiaduje się po fakcie, że segment jest pusty.
 */
export function MailingComposer() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<Segment>(EMPTY);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [counting, setCounting] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const refreshAudience = useCallback(async () => {
    setCounting(true);
    try {
      const res = await fetch("/api/admin/mailing/odbiorcy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: segment.sources.length ? segment.sources : undefined,
          categories: segment.categories.length ? segment.categories : undefined,
          voivodeships: segment.voivodeships.length ? segment.voivodeships : undefined,
          since: segment.since || null,
        }),
      });
      const data = await res.json();
      setAudience(res.ok ? data : null);
      if (!res.ok) setError(data.error ?? "Nie udało się policzyć odbiorców.");
    } catch {
      setAudience(null);
    }
    setCounting(false);
  }, [segment]);

  // Licz po każdej zmianie filtrów, z krótkim opóźnieniem — inaczej klikanie kategorii
  // wysyła zapytanie przy każdym kliknięciu.
  useEffect(() => {
    const t = setTimeout(refreshAudience, 250);
    return () => clearTimeout(t);
  }, [refreshAudience]);

  async function onPreview() {
    setError(null);
    const res = await fetch("/api/admin/mailing/podglad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    const data = await res.json();
    if (res.ok) setPreview(data);
    else setError(data.error ?? "Nie udało się wygenerować podglądu.");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const res = await fetch("/api/admin/mailing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        subject,
        body,
        segment: {
          sources: segment.sources.length ? segment.sources : undefined,
          categories: segment.categories.length ? segment.categories : undefined,
          voivodeships: segment.voivodeships.length ? segment.voivodeships : undefined,
          since: segment.since || null,
        },
      }),
    });
    const data = await res.json();
    setState("idle");
    if (res.ok) router.push(`/admin/mailing/${data.id}`);
    else setError(data.error ?? "Nie udało się zapisać kampanii.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="m-name">Nazwa kampanii (tylko dla nas)</label>
          <input
            id="m-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Nabór jesienny — brwi, śląskie"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="m-subject">Temat wiadomości</label>
          <input
            id="m-subject"
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Nowe terminy szkoleń z dofinansowaniem"
            required
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="m-body">Treść</label>
        <textarea
          id="m-body"
          className="input min-h-[220px] font-mono text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Dzień dobry {{imie_wolacz}},\n\n..."}
          required
        />
        <p className="mt-1.5 text-xs text-muted">
          Zmienne: <code className="font-mono">{"{{imie_wolacz}}"}</code> (imię w wołaczu),{" "}
          <code className="font-mono">{"{{imie}}"}</code>,{" "}
          <code className="font-mono">{"{{kategoria}}"}</code>,{" "}
          <code className="font-mono">{"{{wojewodztwo}}"}</code>. Wiadomość wychodzi jako
          czysty tekst — formatowanie HTML nie zadziała. Stopkę z linkiem rezygnacji
          dokładamy automatycznie.
        </p>
      </div>

      <fieldset className="rounded-[12px] border border-gray-100 p-4">
        <legend className="px-1 text-sm font-bold">Odbiorcy</legend>
        <p className="text-xs text-muted">
          Zawsze wyłącznie osoby z <strong>zaznaczoną zgodą marketingową</strong>. Wypisane
          z mailingu są pomijane automatycznie. Puste filtry = wszystkie takie osoby.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="label mb-1.5">Źródło</p>
            <div className="flex flex-wrap gap-2">
              {([
                ["lead", "Ukończone zgłoszenia"],
                ["aplikacja", "Porzucone aplikacje"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSegment((s) => ({ ...s, sources: toggle(s.sources, value) }))}
                  aria-pressed={segment.sources.includes(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    segment.sources.includes(value)
                      ? "border-navy bg-navy text-white"
                      : "border-gray-200 text-ink hover:border-navy"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label mb-1.5">Kategoria szkolenia</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSegment((s) => ({ ...s, categories: toggle(s.categories, c) }))}
                  aria-pressed={segment.categories.includes(c)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    segment.categories.includes(c)
                      ? "border-navy bg-navy text-white"
                      : "border-gray-200 text-ink hover:border-navy"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="m-woj">Województwo</label>
              <select
                id="m-woj"
                multiple
                size={5}
                className="input h-auto"
                value={segment.voivodeships}
                onChange={(e) =>
                  setSegment((s) => ({
                    ...s,
                    voivodeships: [...e.target.selectedOptions].map((o) => o.value),
                  }))
                }
              >
                {VOIVODESHIPS.map((v) => (
                  <option key={v.slug} value={v.slug}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="m-since">Zgłoszenia od dnia</label>
              <input
                id="m-since"
                type="date"
                className="input"
                value={segment.since}
                onChange={(e) => setSegment((s) => ({ ...s, since: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setSegment(EMPTY)}
                className="mt-3 text-xs font-semibold text-navy underline underline-offset-2"
              >
                Wyczyść filtry
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[10px] bg-gray-50 px-4 py-3 text-sm">
          {counting ? (
            <p className="text-muted">Liczę odbiorców…</p>
          ) : audience ? (
            <>
              <p>
                <strong>{audience.total}</strong>{" "}
                {audience.total === 1 ? "odbiorczyni" : "odbiorczyń"} w tym segmencie
                {audience.unsubscribed > 0 && (
                  <span className="text-muted">
                    {" "}
                    · {audience.unsubscribed} pominięto (wypisane z mailingu)
                  </span>
                )}
              </p>
              {audience.total === 0 && (
                <p className="mt-2 text-xs text-muted">
                  Pusto — i najczęściej nie jest to błąd filtrów. Zgodę marketingową zbieramy
                  dopiero od 19.09.2026, więc starsze zgłoszenia jej nie mają i nie wolno
                  do nich pisać propozycji szkoleń.
                </p>
              )}
              {audience.sample.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted">
                  {audience.sample.map((r) => (
                    <li key={r.email}>
                      {r.email} {r.name ? `· ${r.name}` : ""}{" "}
                      {r.sourceKind === "aplikacja" ? "· porzucona aplikacja" : ""}
                    </li>
                  ))}
                  {audience.total > audience.sample.length && (
                    <li>…i {audience.total - audience.sample.length} więcej</li>
                  )}
                </ul>
              )}
            </>
          ) : (
            <p className="text-muted">—</p>
          )}
        </div>
      </fieldset>

      {preview && (
        <div className="rounded-[12px] border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Podgląd — dokładnie to wyjdzie
          </p>
          <p className="mt-2 font-semibold">{preview.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-ink">
            {preview.body}
          </pre>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={state === "saving"}>
          {state === "saving" ? "Zapisuję…" : "Zapisz kampanię"}
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={onPreview}
          disabled={!subject || body.length < 5}
        >
          Podgląd wiadomości
        </button>
        <span className="text-xs text-muted">
          Zapisanie niczego nie wysyła — wysyłkę uruchamiasz na stronie kampanii.
        </span>
      </div>
    </form>
  );
}
