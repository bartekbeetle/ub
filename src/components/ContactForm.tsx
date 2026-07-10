"use client";

import { useState } from "react";

export function ContactForm({ type = "kontakt" }: { type?: "kontakt" | "konsultacja" }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const fd = new FormData(e.currentTarget);
    const payload = {
      type,
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      message: String(fd.get("message") ?? ""),
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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>Nie wypełniaj <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div>
        <label className="label" htmlFor="c-name">Imię i nazwisko *</label>
        <input id="c-name" name="name" type="text" required className="input" autoComplete="name" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-email">Email *</label>
          <input id="c-email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="c-phone">Telefon</label>
          <input id="c-phone" name="phone" type="tel" className="input" autoComplete="tel" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-message">Wiadomość</label>
        <textarea id="c-message" name="message" rows={5} className="input resize-y" placeholder="W czym możemy pomóc?" />
      </div>
      {state === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Nie udało się wysłać wiadomości. Spróbuj ponownie.
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className="btn-primary w-full disabled:opacity-60">
        {state === "sending" ? "Wysyłanie..." : "Wyślij wiadomość"}
      </button>
    </form>
  );
}
