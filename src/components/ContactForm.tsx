"use client";

import { useRef, useState } from "react";

type Errors = Partial<Record<"name" | "email" | "message", string>>;

/** Walidacja lustrzana wobec `submissionSchema` (zod) na serwerze. */
function validate(fd: FormData, requireMessage: boolean): Errors {
  const e: Errors = {};
  const val = (k: string) => String(fd.get(k) ?? "").trim();
  if (val("name").length < 2) e.name = "Podaj imię — bez tego nie wiemy, jak się do Ciebie zwracać.";
  const email = val("email");
  if (!email) e.email = "Podaj adres e-mail — na niego wyślemy odpowiedź.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "Ten adres e-mail wygląda na niepełny.";
  if (requireMessage && val("message").length < 5) e.message = "Napisz kilka słów, w czym możemy pomóc.";
  return e;
}

export function ContactForm({ type = "kontakt" }: { type?: "kontakt" | "konsultacja" }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errors, setErrors] = useState<Errors>({});

  const err = (field: keyof Errors) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": `c-err-${field}` } : {};

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return; // blokada podwójnego submitu
    const fd = new FormData(e.currentTarget);

    const found = validate(fd, true);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      return;
    }

    setState("sending");
    const payload = {
      type,
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
      website: String(fd.get("website") ?? ""),
    };
    try {
      const res = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-[12px] bg-money-bg p-8 text-center" role="status">
        <h3 className="font-serif text-xl font-bold text-money-dark">Dziękujemy za wiadomość!</h3>
        <p className="mt-2 text-ink">Odpowiemy w ciągu 24 godzin roboczych.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate aria-busy={state === "sending"}>
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>Nie wypełniaj <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div>
        <label className="label" htmlFor="c-name">Imię i nazwisko *</label>
        <input id="c-name" name="name" type="text" required className="input" autoComplete="name" {...err("name")} />
        {errors.name && <p id="c-err-name" role="alert" className="field-error">{errors.name}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-email">Email *</label>
          <input id="c-email" name="email" type="email" required className="input" autoComplete="email" {...err("email")} />
          {errors.email && <p id="c-err-email" role="alert" className="field-error">{errors.email}</p>}
        </div>
        <div>
          <label className="label" htmlFor="c-phone">Telefon</label>
          <input id="c-phone" name="phone" type="tel" className="input" autoComplete="tel" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-message">Wiadomość *</label>
        <textarea id="c-message" name="message" rows={5} className="input resize-y" placeholder="W czym możemy pomóc?" {...err("message")} />
        {errors.message && <p id="c-err-message" role="alert" className="field-error">{errors.message}</p>}
      </div>
      {state === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Nie udało się wysłać wiadomości. Spróbuj ponownie albo napisz na biuro@uniwersytetbeauty.pl.
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className="btn-primary w-full disabled:opacity-60">
        {state === "sending" ? "Wysyłanie..." : "Wyślij wiadomość"}
      </button>
    </form>
  );
}
