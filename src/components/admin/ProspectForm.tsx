"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prospect } from "@/db/schema";
import {
  BUR_SEGMENTS,
  BUR_SEGMENT_LABELS,
  CATEGORIES,
  PROSPECT_PRIORITIES,
  PROSPECT_PRIORITY_LABELS,
  PROSPECT_SOURCES,
  PROSPECT_SOURCE_LABELS,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  VOIVODESHIPS,
} from "@/lib/constants";

/** Puste pole liczbowe ma lecieć jako `""` (API zamieni na null), a nie jako 0. */
function num(fd: FormData, key: string): number | "" {
  const raw = String(fd.get(key) ?? "").trim();
  return raw === "" ? "" : Number(raw);
}

export function ProspectForm({ prospect }: { prospect?: Prospect }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [categories, setCategories] = useState<string[]>(prospect?.categories ?? []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      legalName: String(fd.get("legalName") ?? ""),
      nip: String(fd.get("nip") ?? ""),
      krs: String(fd.get("krs") ?? ""),
      city: String(fd.get("city") ?? ""),
      voivodeship: String(fd.get("voivodeship") ?? ""),
      categories,
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      website: String(fd.get("website") ?? ""),
      instagram: String(fd.get("instagram") ?? ""),
      facebook: String(fd.get("facebook") ?? ""),
      status: String(fd.get("status") ?? "potencjalny"),
      priority: String(fd.get("priority") ?? "sredni"),
      source: String(fd.get("source") ?? "reczny"),
      burSegment: String(fd.get("burSegment") ?? "nieznany"),
      burProviderId: String(fd.get("burProviderId") ?? ""),
      burUrl: String(fd.get("burUrl") ?? ""),
      burServicesCompleted: num(fd, "burServicesCompleted"),
      burServicesActive: num(fd, "burServicesActive"),
      burRatingX10: num(fd, "burRatingX10"),
      burReviewCount: num(fd, "burReviewCount"),
      dossierPath: String(fd.get("dossierPath") ?? ""),
      researchNotes: String(fd.get("researchNotes") ?? ""),
    };

    const res = await fetch(prospect ? `/api/admin/prospekty/${prospect.id}` : "/api/admin/prospekty", {
      method: prospect ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      if (prospect) {
        setSaved(true);
        router.refresh();
      } else {
        const created = await res.json().catch(() => null);
        router.push(created?.id ? `/admin/crm-trenerki/${created.id}` : "/admin/crm-trenerki");
        router.refresh();
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Błąd zapisu.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
      {/* PODMIOT */}
      <fieldset className="card !shadow-none border border-gray-100 p-5">
        <legend className="label px-2">Podmiot</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-name">Nazwa (marka) *</label>
            <input id="p-name" name="name" required maxLength={200} defaultValue={prospect?.name ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="p-legal">Nazwa z rejestru</label>
            <input id="p-legal" name="legalName" maxLength={250} defaultValue={prospect?.legalName ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="p-nip">NIP</label>
            <input id="p-nip" name="nip" maxLength={20} defaultValue={prospect?.nip ?? ""} className="input font-mono text-sm" />
          </div>
          <div>
            <label className="label" htmlFor="p-krs">KRS</label>
            <input id="p-krs" name="krs" maxLength={20} defaultValue={prospect?.krs ?? ""} className="input font-mono text-sm" />
          </div>
          <div>
            <label className="label" htmlFor="p-city">Miasto</label>
            <input id="p-city" name="city" maxLength={100} defaultValue={prospect?.city ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="p-voiv">Województwo</label>
            <select id="p-voiv" name="voivodeship" defaultValue={prospect?.voivodeship ?? ""} className="input">
              <option value="">— brak —</option>
              {VOIVODESHIPS.map((v) => (
                <option key={v.slug} value={v.slug}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <span className="label">Kategorie szkoleń (dopasowanie do leadów)</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={categories.includes(c)}
                  onChange={(e) => setCategories(e.target.checked ? [...categories, c] : categories.filter((x) => x !== c))}
                  className="h-4 w-4 accent-sand-500"
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {/* KONTAKT */}
      <fieldset className="card !shadow-none border border-gray-100 p-5">
        <legend className="label px-2">Kontakt</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-phone">Telefon</label>
            <input id="p-phone" name="phone" maxLength={40} defaultValue={prospect?.phone ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="p-email">E-mail</label>
            <input id="p-email" name="email" type="email" maxLength={255} defaultValue={prospect?.email ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="p-www">WWW</label>
            <input id="p-www" name="website" maxLength={300} defaultValue={prospect?.website ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="p-ig">Instagram</label>
            <input id="p-ig" name="instagram" maxLength={300} defaultValue={prospect?.instagram ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="p-fb">Facebook</label>
            <input id="p-fb" name="facebook" maxLength={300} defaultValue={prospect?.facebook ?? ""} className="input" />
          </div>
        </div>
      </fieldset>

      {/* PIPELINE */}
      <fieldset className="card !shadow-none border border-gray-100 p-5">
        <legend className="label px-2">Pipeline</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="p-status">Status</label>
            <select id="p-status" name="status" defaultValue={prospect?.status ?? "potencjalny"} className="input">
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>{PROSPECT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-priority">Priorytet</label>
            <select id="p-priority" name="priority" defaultValue={prospect?.priority ?? "sredni"} className="input">
              {PROSPECT_PRIORITIES.map((p) => (
                <option key={p} value={p}>{PROSPECT_PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-source">Źródło</label>
            <select id="p-source" name="source" defaultValue={prospect?.source ?? "reczny"} className="input">
              {PROSPECT_SOURCES.map((s) => (
                <option key={s} value={s}>{PROSPECT_SOURCE_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {/* BUR */}
      <fieldset className="card !shadow-none border border-sand-200 bg-sand-50/40 p-5">
        <legend className="label px-2">Baza Usług Rozwojowych (BUR)</legend>
        <p className="mb-4 text-xs text-muted">
          Segment A = podmiot ma wpis do BUR i może dziś sprzedać szkolenie z dofinansowaniem, czyli przyjąć naszego leada.
          Segment B = brak wpisu; taki podmiot nie obsłuży kursantki szukającej dofinansowania.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-bur-seg">Segment</label>
            <select id="p-bur-seg" name="burSegment" defaultValue={prospect?.burSegment ?? "nieznany"} className="input">
              {BUR_SEGMENTS.map((s) => (
                <option key={s} value={s}>{BUR_SEGMENT_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-bur-id">ID dostawcy w PARP</label>
            <input id="p-bur-id" name="burProviderId" maxLength={20} defaultValue={prospect?.burProviderId ?? ""} className="input font-mono text-sm" placeholder="np. 177944" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-bur-url">Link do karty dostawcy</label>
            <input id="p-bur-url" name="burUrl" maxLength={500} defaultValue={prospect?.burUrl ?? ""} className="input text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="p-bur-done">Usługi zrealizowane</label>
              <input id="p-bur-done" name="burServicesCompleted" type="number" min={0} defaultValue={prospect?.burServicesCompleted ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="p-bur-active">Usługi aktywne</label>
              <input id="p-bur-active" name="burServicesActive" type="number" min={0} defaultValue={prospect?.burServicesActive ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="p-bur-rating">Ocena × 10</label>
              <input id="p-bur-rating" name="burRatingX10" type="number" min={0} max={50} defaultValue={prospect?.burRatingX10 ?? ""} className="input" placeholder="50 = 5,0" />
            </div>
            <div>
              <label className="label" htmlFor="p-bur-reviews">Liczba opinii</label>
              <input id="p-bur-reviews" name="burReviewCount" type="number" min={0} defaultValue={prospect?.burReviewCount ?? ""} className="input" />
            </div>
          </div>
        </div>
      </fieldset>

      {/* RESEARCH */}
      <fieldset className="card !shadow-none border border-gray-100 p-5">
        <legend className="label px-2">Research</legend>
        <div>
          <label className="label" htmlFor="p-dossier">Ścieżka do dossier (plik w vaultcie)</label>
          <input
            id="p-dossier"
            name="dossierPath"
            maxLength={500}
            defaultValue={prospect?.dossierPath ?? ""}
            className="input font-mono text-sm"
            placeholder="Zasoby/uniwersytet-beauty/trenerki/nazwa.md"
          />
        </div>
        <div className="mt-4">
          <label className="label" htmlFor="p-research">Notatki z researchu</label>
          <textarea id="p-research" name="researchNotes" rows={6} defaultValue={prospect?.researchNotes ?? ""} className="input resize-y !text-sm" />
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? "Zapisywanie…" : prospect ? "Zapisz zmiany" : "Dodaj prospekta"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-outline">Anuluj</button>
        {saved && <span role="status" className="text-sm font-semibold text-money-dark">Zapisano</span>}
      </div>
    </form>
  );
}
