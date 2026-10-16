"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/Switch";

export function TrackingToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setOn(next);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/mailing/sledzenie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setOn(!next);
      setError("Nie udało się zapisać.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h2 className="font-serif text-lg font-semibold">Śledzenie otwarć i kliknięć</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {on
            ? "Włączone: maile do kursantek i akademii wychodzą z niewidocznym pikselem, a linki przechodzą przez nasz serwer. Działa od następnego maila."
            : "Wyłączone: maile wychodzą bez piksela, więc otwarć i kliknięć nie widać."}{" "}
          Śledzenie to przetwarzanie danych osobowych. Przed włączeniem dopisz je do polityki prywatności (cel: statystyki
          skuteczności wysyłek). Maile wewnętrzne i wiadomości 1:1 z CRM nie są śledzone.
        </p>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
      <Switch checked={on} onChange={change} disabled={busy} label="Śledzenie otwarć i kliknięć" />
    </div>
  );
}
