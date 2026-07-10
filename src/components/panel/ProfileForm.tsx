"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  bio: string;
  phone: string;
  instagram: string;
  facebook: string;
  website: string;
  avatarUrl: string;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/panel/profil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio: String(fd.get("bio")),
        phone: String(fd.get("phone")),
        instagram: String(fd.get("instagram")),
        facebook: String(fd.get("facebook")),
        website: String(fd.get("website")),
        avatarUrl: String(fd.get("avatarUrl")),
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ ok: true, text: "Zapisano zmiany." });
      router.refresh();
    } else {
      setMsg({ ok: false, text: data.error ?? "Błąd zapisu." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="pf-bio">Bio</label>
        <textarea id="pf-bio" name="bio" rows={5} defaultValue={initial.bio} className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pf-phone">Telefon</label>
          <input id="pf-phone" name="phone" type="text" defaultValue={initial.phone} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="pf-avatar">Adres URL zdjęcia (avatar)</label>
          <input id="pf-avatar" name="avatarUrl" type="text" defaultValue={initial.avatarUrl} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="pf-ig">Instagram</label>
          <input id="pf-ig" name="instagram" type="text" defaultValue={initial.instagram} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="pf-fb">Facebook</label>
          <input id="pf-fb" name="facebook" type="text" defaultValue={initial.facebook} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="pf-web">Strona WWW</label>
          <input id="pf-web" name="website" type="text" defaultValue={initial.website} className="input" />
        </div>
      </div>
      {msg && (
        <p role="alert" className={`rounded-lg px-4 py-3 text-sm font-medium ${msg.ok ? "bg-money-bg text-money-dark" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
        {busy ? "Zapisywanie…" : "Zapisz zmiany"}
      </button>
    </form>
  );
}
