"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Submission } from "@/db/schema";
import { CATEGORIES, EMPLOYMENT_STATUSES, VOIVODESHIPS } from "@/lib/constants";

/**
 * Uzupełnienie zgłoszenia do leada. Formularz zbiera DOKŁADNIE to, czego brakuje
 * do przydziału trenerce: województwo, kategorię, status zawodowy i telefon.
 *
 * Checkbox zgody jest tu wymagany po stronie przeglądarki (required), ale prawdziwą
 * bramką jest walidacja serwerowa — bez `rodoConsent: true` endpoint zwraca 400.
 */
export function SubmissionConversionForm({ submission }: { submission: Submission }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [contactConsent, setContactConsent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/zgloszenia/${submission.id}/konwersja`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        voivodeship: String(fd.get("voivodeship") ?? ""),
        category: String(fd.get("category") ?? ""),
        employmentStatus: String(fd.get("employmentStatus") ?? ""),
        preferredDate: String(fd.get("preferredDate") ?? ""),
        notes: String(fd.get("notes") ?? ""),
        rodoConsent: consent,
        contactConsent,
      }),
    });
    setBusy(false);
    if (res.ok) {
      const created = await res.json().catch(() => null);
      router.push(created?.leadId ? `/admin/kursantki/${created.leadId}` : "/admin/kursantki");
      router.refresh();
      return;
    }
    const payload = await res.json().catch(() => ({}));
    setError(payload.error ?? "Nie udało się utworzyć leada.");
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
      <fieldset className="card !shadow-none border border-gray-100 p-5">
        <legend className="label px-2">Dane kontaktowe</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="k-name">Imię i nazwisko *</label>
            <input
              id="k-name"
              name="name"
              required
              minLength={3}
              maxLength={160}
              defaultValue={submission.name}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="k-phone">Telefon *</label>
            <input
              id="k-phone"
              name="phone"
              required
              maxLength={20}
              defaultValue={submission.phone ?? ""}
              className="input"
              placeholder="+48 500 100 200"
            />
            {!submission.phone && (
              <p className="mt-1.5 text-xs text-muted">
                Zgłoszenie przyszło bez telefonu — bez niego trenerka nie ma jak oddzwonić.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="k-email">E-mail</label>
            <input id="k-email" value={submission.email} disabled className="input bg-gray-50" />
            <p className="mt-1.5 text-xs text-muted">
              Przeniesiony ze zgłoszenia. Zmiana adresu oznaczałaby inną osobę — wtedy załóż nowe zgłoszenie.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="card !shadow-none border border-gray-100 p-5">
        <legend className="label px-2">Kwalifikacja</legend>
        <p className="mb-4 text-xs text-muted">
          Tych trzech pól nie ma w formularzu kontaktowym, a bez nich system nie dopasuje żadnej trenerki.
          Uzupełnij je z rozmowy.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="k-voiv">Województwo *</label>
            <select id="k-voiv" name="voivodeship" required defaultValue="" className="input">
              <option value="" disabled>— wybierz —</option>
              {VOIVODESHIPS.map((v) => (
                <option key={v.slug} value={v.slug}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="k-cat">Kategoria szkolenia *</label>
            <select id="k-cat" name="category" required defaultValue="" className="input">
              <option value="" disabled>— wybierz —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="k-empl">Status zawodowy *</label>
            <select id="k-empl" name="employmentStatus" required defaultValue="" className="input">
              <option value="" disabled>— wybierz —</option>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="k-date">Preferowany termin</label>
            <input
              id="k-date"
              name="preferredDate"
              maxLength={120}
              className="input"
              placeholder="np. druga połowa października"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="k-notes">Notatka z rozmowy</label>
            <textarea id="k-notes" name="notes" rows={4} maxLength={4000} className="input resize-y !text-sm" />
          </div>
        </div>
      </fieldset>

      {/* ZGODA — bramka prawna całej operacji */}
      <fieldset className="card !shadow-none border-2 border-sand-600 bg-sand-50/40 p-5">
        <legend className="label px-2">Zgoda na przekazanie danych</legend>
        <p className="mb-4 text-sm text-ink-soft">
          Zgłoszenie z formularza kontaktowego zawiera zgodę wyłącznie na kontakt z Uniwersytetem Beauty.
          Przekazanie danych trenerce to <strong>odrębny podmiot i odrębna podstawa</strong> — potrzebujesz
          osobnej zgody kursantki, odebranej w rozmowie.
        </p>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-sand-500"
          />
          <span>
            Potwierdzam, że <strong>{submission.name}</strong> wyraziła zgodę na przekazanie swoich danych
            kontaktowych partnerskiej trenerce w celu przedstawienia oferty szkolenia z dofinansowaniem.
          </span>
        </label>

        {/* Osobna, NIEobowiązkowa zgoda: bez niej lead ma w panelu „brak — nie dzwonić",
            a agent głosowy go pomija. Skoro i tak rozmawiasz z kursantką przy uzupełnianiu,
            to jest jedyny moment, żeby ją odebrać — inaczej konwersja produkuje leady,
            do których nikomu nie wolno zadzwonić. */}
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={contactConsent}
            onChange={(e) => setContactConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-sand-500"
          />
          <span>
            Zgodziła się również na <strong>kontakt telefoniczny i SMS</strong> w sprawie szkolenia.
            <span className="block text-xs text-ink-soft">
              Nieobowiązkowe. Bez tego nikt — ani trenerka, ani recepcjonistka — nie zadzwoni do niej zgodnie z prawem.
            </span>
          </span>
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !consent} className="btn-primary disabled:opacity-50">
          {busy ? "Tworzenie leada…" : "Utwórz leada"}
        </button>
        <button type="button" onClick={() => router.push("/admin/kursantki")} className="btn-outline">
          Anuluj
        </button>
      </div>
    </form>
  );
}
