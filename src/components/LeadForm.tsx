"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, EMPLOYMENT_STATUSES, VOIVODESHIPS } from "@/lib/constants";

type Props = {
  courseId?: number;
  defaultCategory?: string;
  defaultVoivodeship?: string;
  source?: "kurs" | "landing" | "konsultacja";
};

type Errors = Partial<Record<"name" | "phone" | "email" | "voivodeship" | "category" | "employmentStatus" | "rodoConsent", string>>;

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

/**
 * Walidacja lustrzana wobec `leadSchema` (zod) na serwerze. Formularz ma `noValidate`,
 * bo dymki przeglądarki są nieprzetłumaczalne i znikają — komunikat musi zostać pod polem.
 * Bez tej warstwy pusty formularz szedł do API i wracał jednym ogólnym błędem na górze,
 * bez wskazania, które z siedmiu pól jest do poprawki.
 */
function validate(fd: FormData): Errors {
  const e: Errors = {};
  const val = (k: string) => String(fd.get(k) ?? "").trim();

  if (val("name").length < 3) e.name = "Podaj imię i nazwisko (min. 3 znaki).";
  const phone = val("phone");
  if (phone.length < 9) e.phone = "Podaj numer telefonu — min. 9 cyfr.";
  else if (!/^[+\d\s-]+$/.test(phone)) e.phone = "Numer może zawierać tylko cyfry, spacje, myślnik i +.";
  const email = val("email");
  if (!email) e.email = "Podaj adres e-mail.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "Ten adres e-mail wygląda na niepełny.";
  if (!val("voivodeship")) e.voivodeship = "Wybierz województwo — od niego zależy operator dofinansowania.";
  if (!val("category")) e.category = "Wybierz kategorię szkolenia.";
  if (!val("employmentStatus")) e.employmentStatus = "Wybierz status zawodowy.";
  if (fd.get("rodoConsent") !== "on") e.rodoConsent = "Bez tej zgody nie możemy przekazać Twojego zgłoszenia trenerce.";
  return e;
}

export function LeadForm({ courseId, defaultCategory, defaultVoivodeship, source = "landing" }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [utm, setUtm] = useState({ utmSource: "", utmMedium: "", utmCampaign: "" });

  useEffect(() => {
    setUtm(getUtm());
  }, []);

  const err = (field: keyof Errors) =>
    errors[field]
      ? { "aria-invalid": true as const, "aria-describedby": `lead-err-${field}` }
      : {};

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return; // druga blokada podwójnego submitu (obok disabled na przycisku)
    setError(null);
    const fd = new FormData(e.currentTarget);

    const found = validate(fd);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Fokus na pierwsze błędne pole — inaczej na mobile użytkowniczka nie widzi, co jest nie tak.
      const first = Object.keys(found)[0];
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
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
        if (data.field) setErrors({ [data.field]: data.error } as Errors);
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
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate aria-busy={submitting}>
      {/* honeypot — ukryty dla ludzi */}
      <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
        <label>
          Nie wypełniaj tego pola
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label className="label" htmlFor="lead-name">Imię i nazwisko *</label>
        <input id="lead-name" name="name" type="text" required minLength={3} autoComplete="name" className="input" placeholder="np. Anna Kowalska" {...err("name")} />
        {errors.name && <p id="lead-err-name" role="alert" className="field-error">{errors.name}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lead-phone">Telefon *</label>
          <input id="lead-phone" name="phone" type="tel" required minLength={9} autoComplete="tel" className="input" placeholder="np. 512 345 678" {...err("phone")} />
          {errors.phone && <p id="lead-err-phone" role="alert" className="field-error">{errors.phone}</p>}
        </div>
        <div>
          <label className="label" htmlFor="lead-email">Email *</label>
          <input id="lead-email" name="email" type="email" required autoComplete="email" className="input" placeholder="np. anna@email.pl" {...err("email")} />
          {errors.email && <p id="lead-err-email" role="alert" className="field-error">{errors.email}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lead-voiv">Województwo *</label>
          <select id="lead-voiv" name="voivodeship" required defaultValue={defaultVoivodeship ?? ""} className="input" {...err("voivodeship")}>
            <option value="" disabled>Wybierz województwo</option>
            {VOIVODESHIPS.map((v) => (
              <option key={v.slug} value={v.slug}>{v.name}</option>
            ))}
          </select>
          {errors.voivodeship && <p id="lead-err-voivodeship" role="alert" className="field-error">{errors.voivodeship}</p>}
        </div>
        <div>
          <label className="label" htmlFor="lead-cat">Kategoria szkolenia *</label>
          <select id="lead-cat" name="category" required defaultValue={defaultCategory ?? ""} className="input" {...err("category")}>
            <option value="" disabled>Wybierz kategorię</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.category && <p id="lead-err-category" role="alert" className="field-error">{errors.category}</p>}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="lead-status">Twój status zawodowy *</label>
        <select id="lead-status" name="employmentStatus" required defaultValue="" className="input" {...err("employmentStatus")}>
          <option value="" disabled>Wybierz status (ważne dla dofinansowania)</option>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {errors.employmentStatus && <p id="lead-err-employmentStatus" role="alert" className="field-error">{errors.employmentStatus}</p>}
      </div>

      <div>
        <label className="label" htmlFor="lead-date">Preferowany termin (opcjonalnie)</label>
        <input id="lead-date" name="preferredDate" type="text" className="input" placeholder="np. weekendy, od marca" />
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            name="rodoConsent"
            required
            className="mt-1 h-5 w-5 shrink-0 accent-sand-700"
            {...(errors.rodoConsent ? { "aria-invalid": true as const, "aria-describedby": "lead-err-rodoConsent" } : {})}
          />
          <span>
            Wyrażam zgodę na przetwarzanie moich danych osobowych w celu przedstawienia oferty szkoleniowej i
            kontaktu ze strony trenerek współpracujących z Uniwersytet Beauty, zgodnie z{" "}
            <a href="/polityka-prywatnosci" target="_blank" rel="noopener" className="font-semibold text-sand-700 underline">
              polityką prywatności
            </a>
            . *
          </span>
        </label>
        {errors.rodoConsent && <p id="lead-err-rodoConsent" role="alert" className="field-error">{errors.rodoConsent}</p>}
      </div>

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
