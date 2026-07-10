"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Trainer } from "@/db/schema";
import { CATEGORIES, VOIVODESHIPS } from "@/lib/constants";
import { slugify } from "@/lib/utils";

export function TrainerForm({ trainer }: { trainer?: Trainer }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(trainer?.name ?? "");
  const [slug, setSlug] = useState(trainer?.slug ?? "");
  const [specs, setSpecs] = useState<string[]>(trainer?.specializations ?? []);
  const [certs, setCerts] = useState<{ title: string; description?: string }[]>(trainer?.certificates ?? []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name,
      slug,
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      bio: String(fd.get("bio") ?? ""),
      specializations: specs,
      city: String(fd.get("city") ?? ""),
      voivodeship: String(fd.get("voivodeship") ?? ""),
      avatarUrl: String(fd.get("avatarUrl") ?? ""),
      coverUrl: String(fd.get("coverUrl") ?? ""),
      certificates: certs.filter((c) => c.title.trim()),
      instagram: String(fd.get("instagram") ?? ""),
      facebook: String(fd.get("facebook") ?? ""),
      website: String(fd.get("website") ?? ""),
      studentsCount: Number(fd.get("studentsCount") ?? 0),
      billingModel: String(fd.get("billingModel")) as "per_lead" | "per_zapis",
      rate: Number(fd.get("rate") ?? 100),
      leadLimitMonthly: Number(fd.get("leadLimitMonthly") ?? 50),
      isActive: fd.get("isActive") === "on",
    };
    const res = await fetch(trainer ? `/api/admin/trenerki/${trainer.id}` : "/api/admin/trenerki", {
      method: trainer ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/admin/trenerki");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Błąd zapisu.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-name">Imię i nazwisko *</label>
          <input
            id="t-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!trainer) setSlug(slugify(e.target.value));
            }}
            required
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="t-slug">Slug (URL) *</label>
          <input id="t-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" className="input font-mono text-sm" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-email">Email (dostaje leady)</label>
          <input id="t-email" name="email" type="email" defaultValue={trainer?.email ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="t-phone">Telefon</label>
          <input id="t-phone" name="phone" defaultValue={trainer?.phone ?? ""} className="input" />
        </div>
      </div>

      <div>
        <span className="label">Specjalizacje * (dopasowanie leadów)</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={specs.includes(c)}
                onChange={(e) => setSpecs(e.target.checked ? [...specs, c] : specs.filter((s) => s !== c))}
                className="h-4 w-4 accent-sand-500"
              />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-city">Miasto</label>
          <input id="t-city" name="city" defaultValue={trainer?.city ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="t-voiv">Województwo (dopasowanie leadów)</label>
          <select id="t-voiv" name="voivodeship" defaultValue={trainer?.voivodeship ?? ""} className="input">
            <option value="">— brak —</option>
            {VOIVODESHIPS.map((v) => <option key={v.slug} value={v.slug}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="t-bio">Bio</label>
        <textarea id="t-bio" name="bio" rows={5} defaultValue={trainer?.bio ?? ""} className="input resize-y" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-avatar">Avatar URL</label>
          <input id="t-avatar" name="avatarUrl" defaultValue={trainer?.avatarUrl ?? ""} className="input" placeholder="/images/… lub https://…" />
        </div>
        <div>
          <label className="label" htmlFor="t-cover">Cover URL</label>
          <input id="t-cover" name="coverUrl" defaultValue={trainer?.coverUrl ?? ""} className="input" />
        </div>
      </div>

      <div>
        <span className="label">Certyfikaty i osiągnięcia</span>
        <div className="space-y-2">
          {certs.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={c.title}
                onChange={(e) => setCerts(certs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                placeholder="Tytuł certyfikatu"
                className="input !py-2 !text-sm"
              />
              <input
                value={c.description ?? ""}
                onChange={(e) => setCerts(certs.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                placeholder="Opis (opcjonalnie)"
                className="input !py-2 !text-sm"
              />
              <button type="button" onClick={() => setCerts(certs.filter((_, j) => j !== i))} className="shrink-0 text-sm font-semibold text-red-600" aria-label="Usuń certyfikat">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setCerts([...certs, { title: "" }])} className="text-sm font-semibold text-sand-700 hover:underline">
            + Dodaj certyfikat
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="t-ig">Instagram</label>
          <input id="t-ig" name="instagram" defaultValue={trainer?.instagram ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="t-fb">Facebook</label>
          <input id="t-fb" name="facebook" defaultValue={trainer?.facebook ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="t-www">WWW</label>
          <input id="t-www" name="website" defaultValue={trainer?.website ?? ""} className="input" />
        </div>
      </div>

      <fieldset className="card !shadow-none border border-sand-200 p-5">
        <legend className="label px-2">Rozliczenia</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="t-model">Model rozliczenia</label>
            <select id="t-model" name="billingModel" defaultValue={trainer?.billingModel ?? "per_lead"} className="input">
              <option value="per_lead">Opłata za lead</option>
              <option value="per_zapis">Opłata za zapis</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-rate">Stawka (PLN)</label>
            <input id="t-rate" name="rate" type="number" min={0} defaultValue={trainer?.rate ?? 100} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="t-limit">Limit leadów / mies.</label>
            <input id="t-limit" name="leadLimitMonthly" type="number" min={0} defaultValue={trainer?.leadLimitMonthly ?? 50} className="input" />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-students">Liczba przeszkolonych (statystyka)</label>
          <input id="t-students" name="studentsCount" type="number" min={0} defaultValue={trainer?.studentsCount ?? 0} className="input" />
        </div>
        <label className="mt-7 flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" name="isActive" defaultChecked={trainer?.isActive ?? true} className="h-5 w-5 accent-sand-500" />
          Aktywna (bierze udział w dystrybucji leadów)
        </label>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={busy || specs.length === 0} className="btn-primary disabled:opacity-50">
          {busy ? "Zapisywanie…" : trainer ? "Zapisz zmiany" : "Dodaj trenerkę"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-outline">Anuluj</button>
      </div>
      {specs.length === 0 && <p className="text-xs text-red-600">Zaznacz co najmniej jedną specjalizację.</p>}
    </form>
  );
}
