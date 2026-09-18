"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/db/schema";

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("saving");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/ustawienia", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        multiSellLimit: Number(fd.get("multiSellLimit")),
        defaultRatePerLead: Number(fd.get("defaultRatePerLead")),
        defaultRatePerSignup: Number(fd.get("defaultRatePerSignup")),
        notifyEmail: String(fd.get("notifyEmail")),
        leadEmailSubject: String(fd.get("leadEmailSubject")),
        leadEmailTemplate: String(fd.get("leadEmailTemplate")),
        confirmEmailSubject: String(fd.get("confirmEmailSubject")),
        confirmEmailTemplate: String(fd.get("confirmEmailTemplate")),
        signupEmailSubject: String(fd.get("signupEmailSubject")),
        signupEmailTemplate: String(fd.get("signupEmailTemplate")),
      }),
    });
    setState(res.ok ? "saved" : "error");
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="s-multisell">Limit multi-sell (trenerek / lead)</label>
          <input id="s-multisell" name="multiSellLimit" type="number" min={1} max={3} defaultValue={settings.multiSellLimit} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="s-ratelead">Domyślna stawka za lead (PLN)</label>
          <input id="s-ratelead" name="defaultRatePerLead" type="number" min={0} defaultValue={settings.defaultRatePerLead} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="s-ratesignup">Domyślna stawka za zapis (PLN)</label>
          <input id="s-ratesignup" name="defaultRatePerSignup" type="number" min={0} defaultValue={settings.defaultRatePerSignup} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="s-notify">Email powiadomień (wewnętrzny)</label>
        <input id="s-notify" name="notifyEmail" type="email" defaultValue={settings.notifyEmail} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="s-subject">Temat maila do trenerki</label>
        <input id="s-subject" name="leadEmailSubject" defaultValue={settings.leadEmailSubject} className="input font-mono text-sm" />
      </div>
      <div>
        <label className="label" htmlFor="s-template">
          Treść maila do trenerki — zmienne: {"{{trenerka}} {{imie}} {{telefon}} {{email}} {{kategoria}} {{wojewodztwo}} {{status_zawodowy}}"}
        </label>
        <textarea id="s-template" name="leadEmailTemplate" rows={12} defaultValue={settings.leadEmailTemplate} className="input resize-y font-mono text-sm" />
      </div>

      <div className="border-t border-slate-200 pt-5">
        <h2 className="text-base font-bold text-ink">Maile do kursantki</h2>
        <p className="mt-1 text-sm text-slate-600">
          Wiadomości transakcyjne — wysyłane automatycznie. Obowiązuje guardrail ceny:
          nigdy „kurs za 0 zł", zawsze „do 90%, zależnie od województwa i naboru".
        </p>
      </div>

      <div>
        <label className="label" htmlFor="s-confirm-subject">Temat: potwierdzenie zgłoszenia</label>
        <input id="s-confirm-subject" name="confirmEmailSubject" defaultValue={settings.confirmEmailSubject} className="input font-mono text-sm" />
      </div>
      <div>
        <label className="label" htmlFor="s-confirm-template">
          Treść: potwierdzenie zgłoszenia (wysyłane od razu po wypełnieniu formularza) — zmienne:{" "}
          {"{{imie}} {{kategoria}} {{wojewodztwo}} {{miasto}} {{telefon}} {{email}} {{status_zawodowy}}"}
        </label>
        <textarea id="s-confirm-template" name="confirmEmailTemplate" rows={12} defaultValue={settings.confirmEmailTemplate} className="input resize-y font-mono text-sm" />
      </div>

      <div>
        <label className="label" htmlFor="s-signup-subject">Temat: potwierdzenie zapisu</label>
        <input id="s-signup-subject" name="signupEmailSubject" defaultValue={settings.signupEmailSubject} className="input font-mono text-sm" />
      </div>
      <div>
        <label className="label" htmlFor="s-signup-template">
          Treść: potwierdzenie zapisu (wysyłane, gdy akademia oznaczy kursantkę jako zapisaną) — zmienne:{" "}
          {"{{imie}} {{trenerka}} {{kategoria}} {{wojewodztwo}}"}
        </label>
        <textarea id="s-signup-template" name="signupEmailTemplate" rows={10} defaultValue={settings.signupEmailTemplate} className="input resize-y font-mono text-sm" />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={state === "saving"} className="btn-primary disabled:opacity-50">
          {state === "saving" ? "Zapisywanie…" : "Zapisz ustawienia"}
        </button>
        {state === "saved" && <span role="status" className="text-sm font-semibold text-money-dark">Zapisano</span>}
        {state === "error" && <span className="text-sm font-semibold text-red-600">Błąd zapisu</span>}
      </div>
    </form>
  );
}
