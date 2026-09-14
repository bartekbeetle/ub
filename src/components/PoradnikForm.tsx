"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUtm } from "@/lib/utm";

/**
 * Formularz pobrania poradnika (lead magnet).
 *
 * 🔴 DLACZEGO TO NIE JEST LEAD, TYLKO SESJA:
 * lead w naszym modelu oznacza zgodę na PRZEKAZANIE danych akademii (`rodoConsent`)
 * i wchodzi do przydziału. Tutaj kobieta tylko pobiera PDF — nikomu jej danych nie
 * przekazujemy. Dlatego zapis idzie do `quiz_sessions` przez `/api/quiz-progress`,
 * a nie do `leads`. Granica „mamy podstawę / nie mamy podstawy" zostaje ostra.
 *
 * Zgoda marketingowa jest DOBROWOLNA i tylko ona pozwala później napisać maila
 * (art. 398 Prawa komunikacji elektronicznej). Bez niej rekord służy wyłącznie
 * statystyce i remarketingowi przez piksel.
 *
 * Dostawa PDF-a: natychmiastowe przekierowanie na stronę z linkiem do pobrania.
 * Świadomie NIE wysyłamy mailem — SMTP w UB nie jest skonfigurowany, więc obietnica
 * „wyślemy na maila" byłaby obietnicą bez pokrycia.
 */

const WOJEWODZTWA = [
  { slug: "slaskie", nazwa: "śląskie" },
  { slug: "wielkopolskie", nazwa: "wielkopolskie" },
] as const;

type Errors = Partial<Record<"name" | "email" | "voivodeship", string>>;

export function PoradnikForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [voivodeship, setVoivodeship] = useState("");
  const [zgoda, setZgoda] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [wysylam, setWysylam] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);

  function waliduj(): Errors {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = "Podaj imię.";
    const mail = email.trim();
    if (!mail) e.email = "Podaj adres e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) e.email = "Ten adres wygląda na niepełny.";
    if (!voivodeship) e.voivodeship = "Wybierz województwo — poradnik ma dwie wersje.";
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (wysylam) return;
    if (honeypot.current?.value) return; // bot
    const found = waliduj();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setWysylam(true);
    const utm = getUtm();
    try {
      await fetch("/api/quiz-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          sessionKey: crypto.randomUUID(),
          step: 1,
          name: name.trim(),
          email: email.trim(),
          voivodeship,
          marketingConsent: zgoda,
          answers: { zrodlo: "poradnik", wojewodztwo: voivodeship },
          ...utm,
        }),
      });
    } catch {
      // Pobranie poradnika NIGDY nie może paść przez błąd zapisu — PDF jest ważniejszy.
    }
    router.push(`/poradnik/dziekujemy?w=${voivodeship}`);
  }

  const err = (f: keyof Errors) =>
    errors[f] ? { "aria-invalid": true as const, "aria-describedby": `por-err-${f}` } : {};

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <label className="sr-only" aria-hidden="true">
        Nie wypełniaj tego pola
        <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <div>
        <label className="label" htmlFor="por-name">Imię *</label>
        <input
          id="por-name" type="text" autoComplete="given-name" className="input"
          placeholder="np. Anna" value={name} onChange={(e) => setName(e.target.value)} {...err("name")}
        />
        {errors.name && <p id="por-err-name" role="alert" className="field-error">{errors.name}</p>}
      </div>

      <div>
        <label className="label" htmlFor="por-email">Adres e-mail *</label>
        <input
          id="por-email" type="email" autoComplete="email" inputMode="email" className="input"
          placeholder="np. anna@email.pl" value={email} onChange={(e) => setEmail(e.target.value)} {...err("email")}
        />
        {errors.email && <p id="por-err-email" role="alert" className="field-error">{errors.email}</p>}
      </div>

      <div>
        <label className="label" htmlFor="por-woj">Twoje województwo *</label>
        <select
          id="por-woj" className="input" value={voivodeship}
          onChange={(e) => setVoivodeship(e.target.value)} {...err("voivodeship")}
        >
          <option value="" disabled>Wybierz województwo</option>
          {WOJEWODZTWA.map((w) => (
            <option key={w.slug} value={w.slug}>{w.nazwa}</option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted">
          Zasady dofinansowania różnią się między województwami, dlatego poradnik ma dwie wersje.
        </p>
        {errors.voivodeship && <p id="por-err-voivodeship" role="alert" className="field-error">{errors.voivodeship}</p>}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[10px] bg-sand-50 p-3 text-sm text-muted">
        <input
          type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-sand-700"
          checked={zgoda} onChange={(e) => setZgoda(e.target.checked)}
        />
        <span>
          Chcę dostawać e-mailem informacje o naborach i terminach szkoleń z dofinansowaniem.
          Zgoda jest dobrowolna i mogę ją wycofać w każdej chwili.
        </span>
      </label>

      <button type="submit" disabled={wysylam} className="btn-primary w-full">
        {wysylam ? "Przygotowuję poradnik…" : "Pobierz poradnik"}
      </button>

      <p className="text-center text-xs text-muted">
        Poradnik pobierzesz od razu, bez czekania na maila.
      </p>
    </form>
  );
}
