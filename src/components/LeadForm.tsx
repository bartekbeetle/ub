"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, EMPLOYMENT_STATUSES, VOIVODESHIPS } from "@/lib/constants";

type Props = {
  courseId?: number;
  defaultCategory?: string;
  defaultVoivodeship?: string;
  source?: "kurs" | "landing" | "konsultacja";
};

function getUtm(): { utmSource: string; utmMedium: string; utmCampaign: string } {
  if (typeof window === "undefined") return { utmSource: "", utmMedium: "", utmCampaign: "" };
  const params = new URLSearchParams(window.location.search);
  const stored = sessionStorage.getItem("ub_utm");
  const fromUrl = {
    utmSource: params.get("utm_source") ?? "",
    utmMedium: params.get("utm_medium") ?? "",
    utmCampaign: params.get("utm_campaign") ?? "",
  };
  if (fromUrl.utmSource || fromUrl.utmMedium || fromUrl.utmCampaign) {
    sessionStorage.setItem("ub_utm", JSON.stringify(fromUrl));
    return fromUrl;
  }
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      /* ignore */
    }
  }
  return fromUrl;
}

export function LeadForm({ courseId, defaultCategory, defaultVoivodeship, source = "landing" }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [utm, setUtm] = useState({ utmSource: "", utmMedium: "", utmCampaign: "" });

  useEffect(() => {
    setUtm(getUtm());
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      voivodeship: String(fd.get("voivodeship") ?? ""),
      category: String(fd.get("category") ?? ""),
      employmentStatus: String(fd.get("employmentStatus") ?? ""),
      preferredDate: String(fd.get("preferredDate") ?? ""),
      rodoConsent: fd.get("rodoConsent") === "on",
      website: String(fd.get("website") ?? ""), // honeypot
      courseId: courseId ?? null,
      source,
      ...utm,
    };
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Coś poszło nie tak. Spróbuj ponownie lub napisz do nas.");
        setSubmitting(false);
        return;
      }
      router.push("/dziekujemy");
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {/* honeypot — ukryty dla ludzi */}
      <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
        <label>
          Nie wypełniaj tego pola
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label className="label" htmlFor="lead-name">Imię i nazwisko *</label>
        <input id="lead-name" name="name" type="text" required minLength={3} autoComplete="name" className="input" placeholder="np. Anna Kowalska" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lead-phone">Telefon *</label>
          <input id="lead-phone" name="phone" type="tel" required minLength={9} autoComplete="tel" className="input" placeholder="np. 512 345 678" />
        </div>
        <div>
          <label className="label" htmlFor="lead-email">Email *</label>
          <input id="lead-email" name="email" type="email" required autoComplete="email" className="input" placeholder="np. anna@email.pl" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lead-voiv">Województwo *</label>
          <select id="lead-voiv" name="voivodeship" required defaultValue={defaultVoivodeship ?? ""} className="input">
            <option value="" disabled>Wybierz województwo</option>
            {VOIVODESHIPS.map((v) => (
              <option key={v.slug} value={v.slug}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="lead-cat">Kategoria szkolenia *</label>
          <select id="lead-cat" name="category" required defaultValue={defaultCategory ?? ""} className="input">
            <option value="" disabled>Wybierz kategorię</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="lead-status">Twój status zawodowy *</label>
        <select id="lead-status" name="employmentStatus" required defaultValue="" className="input">
          <option value="" disabled>Wybierz status (ważne dla dofinansowania)</option>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="lead-date">Preferowany termin (opcjonalnie)</label>
        <input id="lead-date" name="preferredDate" type="text" className="input" placeholder="np. weekendy, od marca" />
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="rodoConsent" required className="mt-1 h-5 w-5 shrink-0 accent-sand-500" />
        <span>
          Wyrażam zgodę na przetwarzanie moich danych osobowych w celu przedstawienia oferty szkoleniowej i
          kontaktu ze strony trenerek współpracujących z Uniwersytet Beauty, zgodnie z{" "}
          <a href="/polityka-prywatnosci" target="_blank" className="font-semibold text-sand-700 underline">
            polityką prywatności
          </a>
          . *
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60 disabled:hover:translate-y-0">
        {submitting ? "Wysyłanie..." : "Aplikuj o dofinansowanie"}
      </button>
      <p className="text-center text-xs text-muted">Skontaktujemy się z Tobą w ciągu 24h. Zero spamu.</p>
    </form>
  );
}
