"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/kanban/Modal";

/**
 * „Dodaj trenerkę" — tworzy trenerkę BEZ umowy i tablicę Kanban na każdą zaznaczoną kategorię.
 * Nic nie wysyła i nie zakłada konta logowania.
 */
export function AddTrainerButton({ categories }: { categories: readonly string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/crm-kursantki/trenerki", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name") ?? ""),
        city: String(fd.get("city") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        categories: picked,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Nie udało się dodać trenerki.");
      return;
    }
    const data = (await res.json()) as { boardIds: number[] };
    setOpen(false);
    setPicked([]);
    router.push(`/admin/crm-kursantki?tablica=${data.boardIds[0]}`);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary !px-4 !py-2 !text-sm">
        + Dodaj trenerkę
      </button>
      {open && (
        <Modal title="Nowa trenerka" onCancel={() => setOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(e.currentTarget);
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="nt-name" className="label">Trenerka / akademia</label>
              <input id="nt-name" name="name" required minLength={2} maxLength={160} className="input" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="nt-city" className="label">Miasto</label>
                <input id="nt-city" name="city" maxLength={100} className="input" />
              </div>
              <div>
                <label htmlFor="nt-phone" className="label">Telefon</label>
                <input id="nt-phone" name="phone" maxLength={40} className="input" />
              </div>
            </div>
            <div>
              <label htmlFor="nt-email" className="label">E-mail (opcjonalnie)</label>
              <input id="nt-email" name="email" type="email" maxLength={255} className="input" />
            </div>
            <fieldset>
              <legend className="label">Kategorie kursów — każda dostanie swoją tablicę</legend>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {categories.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(c)}
                      onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c] : p.filter((x) => x !== c)))}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-muted">Trenerka powstaje bez umowy: nie dostaje żadnych danych kursantek, dopóki tego nie zmienisz.</p>
            {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-outline !px-5 !py-2 !text-sm">Anuluj</button>
              <button type="submit" disabled={busy || picked.length === 0} className="btn-primary !px-5 !py-2 !text-sm disabled:opacity-50">
                {busy ? "Dodaję…" : "Dodaj i utwórz tablice"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
