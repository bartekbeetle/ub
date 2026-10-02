"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type TeamMember = {
  id: number;
  email: string;
  role: "admin" | "superadmin" | "trenerka";
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};

type Revealed = { email: string; password: string; kind: "created" | "reset" };

/**
 * Zespół administracji — tworzenie konta admina, wyłączanie/włączanie, odbieranie dostępu,
 * reset hasła. Hasło tymczasowe pokazuje się RAZ (w bazie leży tylko hash), tak samo jak przy
 * kontach trenerek (`TrainerAccountButton`). Konto superadmina jest tylko do odczytu —
 * reguły egzekwuje serwer (`src/lib/team.ts`), tu tylko nie rysujemy przycisków.
 */
export function TeamManager({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRevealed(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusyId("create");
    const res = await fetch("/api/admin/zespol", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? "") }),
    });
    setBusyId(null);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setRevealed({ email: data.email, password: data.password, kind: "created" });
      form.reset();
      router.refresh();
    } else {
      setError(data.error ?? "Nie udało się utworzyć konta.");
    }
  }

  async function act(member: TeamMember, action: "disable" | "enable" | "revoke" | "reset_password") {
    const prompts: Record<typeof action, string> = {
      disable: `Wyłączyć konto ${member.email}?\n\nZostanie natychmiast wylogowany ze wszystkich urządzeń i nie zaloguje się, dopóki go nie włączysz.`,
      enable: `Włączyć konto ${member.email}?`,
      revoke: `Odebrać dostęp ${member.email}?\n\nKonto przestaje być adminem i zostaje wyłączone. Wpisy w dzienniku zmian zostają.`,
      reset_password: `Zresetować hasło ${member.email}?\n\nStare hasło przestanie działać, a nowe (tymczasowe) zobaczysz na ekranie.`,
    };
    if (!window.confirm(prompts[action])) return;
    setError(null);
    setRevealed(null);
    setBusyId(member.id);
    const res = await fetch(`/api/admin/zespol/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.password) setRevealed({ email: member.email, password: data.password, kind: "reset" });
      router.refresh();
    } else {
      setError(data.error ?? "Nie udało się wykonać operacji.");
    }
  }

  return (
    <div>
      <div className="card p-6">
        <h2 className="font-serif text-lg font-semibold">Dodaj admina</h2>
        <p className="mt-1 text-sm text-muted">
          Admin ma dostęp do całego panelu operacyjnego, bez rozliczeń, ustawień i zespołu. Przy pierwszym logowaniu
          musi ustawić własne hasło.
        </p>
        <form onSubmit={create} className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="team-email">Adres e-mail (login)</label>
            <input id="team-email" name="email" type="email" required autoComplete="off" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="team-password">Hasło tymczasowe (puste = wygeneruj)</label>
            <input id="team-password" name="password" type="text" minLength={10} autoComplete="off" className="input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busyId === "create"} className="btn-primary !px-4 !py-2 !text-sm disabled:opacity-50">
              {busyId === "create" ? "Tworzenie…" : "Utwórz konto admina"}
            </button>
          </div>
        </form>

        {revealed && (
          <div className="mt-4 rounded-[12px] border border-amber-300 bg-amber-50 p-4 text-sm" role="status">
            <p className="font-semibold text-amber-900">
              {revealed.kind === "created" ? "Konto utworzone." : "Hasło zresetowane."} Zapisz teraz, nie pokażemy go
              drugi raz.
            </p>
            <dl className="mt-2 grid grid-cols-[80px_1fr] gap-y-1">
              <dt className="text-amber-900/70">Login</dt>
              <dd className="font-mono break-all">{revealed.email}</dd>
              <dt className="text-amber-900/70">Hasło</dt>
              <dd className="font-mono break-all select-all">{revealed.password}</dd>
            </dl>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Konto</th>
              <th className="px-4 py-3 font-semibold">Rola</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => {
              const isSuper = m.role === "superadmin";
              const busy = busyId === m.id;
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{m.email}</p>
                    <p className="text-xs text-muted">
                      Utworzone {new Date(m.createdAt).toLocaleDateString("pl-PL")}
                      {m.mustChangePassword ? " · czeka na zmianę hasła" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isSuper ? "bg-sand-100 text-sand-700" : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {isSuper ? "Superadmin" : "Admin"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        m.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {m.isActive ? "Aktywne" : "Wyłączone"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isSuper ? (
                      <span className="text-xs text-muted">Konto właściciela, bez zmian z panelu</span>
                    ) : (
                      <div className="flex flex-wrap gap-3 text-xs font-semibold">
                        {m.isActive ? (
                          <button type="button" disabled={busy} onClick={() => act(m, "disable")} className="text-sand-700 hover:underline disabled:opacity-50">
                            Wyłącz
                          </button>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => act(m, "enable")} className="text-sand-700 hover:underline disabled:opacity-50">
                            Włącz
                          </button>
                        )}
                        <button type="button" disabled={busy} onClick={() => act(m, "reset_password")} className="text-sand-700 hover:underline disabled:opacity-50">
                          Reset hasła
                        </button>
                        <button type="button" disabled={busy} onClick={() => act(m, "revoke")} className="text-red-700 hover:underline disabled:opacity-50">
                          Odbierz dostęp
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">Brak kont.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
