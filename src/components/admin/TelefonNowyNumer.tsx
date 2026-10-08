"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizePlPhone } from "@/lib/sms/phone";

/** Otwiera rozmowę z numerem spoza listy (np. ktoś, do kogo dzwonisz pierwszy raz). */
export function TelefonNowyNumer() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const parsed = value.trim() ? normalizePlPhone(value) : null;

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const p = normalizePlPhone(value);
        if (p.ok) router.push(`/admin/telefon?numer=${encodeURIComponent(p.e164)}`);
      }}
    >
      <input
        className="input !text-sm"
        inputMode="tel"
        placeholder="Nowy numer, np. 500 600 700"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={parsed ? !parsed.ok : undefined}
      />
      <button type="submit" disabled={!parsed?.ok} className="btn-outline !px-4 !py-2 !text-sm disabled:opacity-50">
        Otwórz
      </button>
    </form>
  );
}
