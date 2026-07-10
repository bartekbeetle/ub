"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Course } from "@/db/schema";
import { CATEGORIES, LEVELS, MODES, VOIVODESHIPS } from "@/lib/constants";
import { slugify } from "@/lib/utils";

type TrainerOption = { id: number; name: string };

export function CourseForm({ course, trainers }: { course?: Course; trainers: TrainerOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(course?.title ?? "");
  const [slug, setSlug] = useState(course?.slug ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const lines = (name: string) =>
      String(fd.get(name) ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    const trainerIdRaw = String(fd.get("trainerId") ?? "");
    const payload = {
      title,
      slug,
      category: String(fd.get("category")),
      level: String(fd.get("level")),
      mode: String(fd.get("mode")),
      shortDescription: String(fd.get("shortDescription") ?? ""),
      description: String(fd.get("description") ?? ""),
      program: lines("program"),
      includes: lines("includes"),
      forWhom: String(fd.get("forWhom") ?? ""),
      price: Number(fd.get("price") ?? 0),
      subsidyPercent: Number(fd.get("subsidyPercent") ?? 100),
      nextDate: String(fd.get("nextDate") ?? ""),
      totalSpots: Number(fd.get("totalSpots") ?? 8),
      takenSpots: Number(fd.get("takenSpots") ?? 0),
      durationHours: Number(fd.get("durationHours") ?? 16),
      city: String(fd.get("city") ?? ""),
      voivodeship: String(fd.get("voivodeship") ?? ""),
      imageUrl: String(fd.get("imageUrl") ?? ""),
      trainerId: trainerIdRaw ? Number(trainerIdRaw) : null,
      status: String(fd.get("status")) as "szkic" | "opublikowane",
    };
    const res = await fetch(course ? `/api/admin/szkolenia/${course.id}` : "/api/admin/szkolenia", {
      method: course ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/admin/szkolenia");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Błąd zapisu.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
      <div>
        <label className="label" htmlFor="c-title">Tytuł *</label>
        <input
          id="c-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!course) setSlug(slugify(e.target.value));
          }}
          required
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="c-slug">Slug (URL) *</label>
        <input id="c-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" className="input font-mono text-sm" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="c-cat">Kategoria *</label>
          <select id="c-cat" name="category" defaultValue={course?.category ?? CATEGORIES[1]} className="input">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="c-level">Poziom</label>
          <select id="c-level" name="level" defaultValue={course?.level ?? "Podstawowy"} className="input">
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="c-mode">Tryb</label>
          <select id="c-mode" name="mode" defaultValue={course?.mode ?? "Stacjonarny"} className="input">
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="c-price">Cena (PLN) *</label>
          <input id="c-price" name="price" type="number" min={0} required defaultValue={course?.price ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="c-subsidy">Dofinansowanie (%)</label>
          <input id="c-subsidy" name="subsidyPercent" type="number" min={0} max={100} defaultValue={course?.subsidyPercent ?? 100} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="c-hours">Czas (godz.)</label>
          <input id="c-hours" name="durationHours" type="number" min={1} defaultValue={course?.durationHours ?? 16} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="c-date">Najbliższy termin</label>
          <input id="c-date" name="nextDate" type="date" defaultValue={course?.nextDate ?? ""} className="input" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="c-total">Miejsca łącznie</label>
          <input id="c-total" name="totalSpots" type="number" min={1} defaultValue={course?.totalSpots ?? 8} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="c-taken">Miejsca zajęte</label>
          <input id="c-taken" name="takenSpots" type="number" min={0} defaultValue={course?.takenSpots ?? 0} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="c-city">Miasto</label>
          <input id="c-city" name="city" defaultValue={course?.city ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="c-voiv">Województwo</label>
          <select id="c-voiv" name="voivodeship" defaultValue={course?.voivodeship ?? ""} className="input">
            <option value="">— brak —</option>
            {VOIVODESHIPS.map((v) => <option key={v.slug} value={v.slug}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-trainer">Trenerka</label>
          <select id="c-trainer" name="trainerId" defaultValue={course?.trainerId ?? ""} className="input">
            <option value="">— brak —</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="c-img">Zdjęcie (URL)</label>
          <input id="c-img" name="imageUrl" defaultValue={course?.imageUrl ?? ""} placeholder="/images/pmu-brwi.jpg" className="input" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="c-short">Krótki opis (meta / karta)</label>
        <textarea id="c-short" name="shortDescription" rows={2} defaultValue={course?.shortDescription ?? ""} className="input resize-y" />
      </div>
      <div>
        <label className="label" htmlFor="c-desc">Opis (akapity oddzielaj pustą linią)</label>
        <textarea id="c-desc" name="description" rows={6} defaultValue={course?.description ?? ""} className="input resize-y" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-program">Program (1 punkt = 1 linia)</label>
          <textarea id="c-program" name="program" rows={7} defaultValue={(course?.program ?? []).join("\n")} className="input resize-y font-mono text-sm" />
        </div>
        <div>
          <label className="label" htmlFor="c-includes">Co zawiera cena (1 punkt = 1 linia)</label>
          <textarea id="c-includes" name="includes" rows={7} defaultValue={(course?.includes ?? []).join("\n")} className="input resize-y font-mono text-sm" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-forwhom">Dla kogo</label>
        <textarea id="c-forwhom" name="forWhom" rows={2} defaultValue={course?.forWhom ?? ""} className="input resize-y" />
      </div>

      <div>
        <label className="label" htmlFor="c-status">Status</label>
        <select id="c-status" name="status" defaultValue={course?.status ?? "szkic"} className="input max-w-xs">
          <option value="szkic">Szkic</option>
          <option value="opublikowane">Opublikowane</option>
        </select>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? "Zapisywanie…" : course ? "Zapisz zmiany" : "Dodaj szkolenie"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-outline">Anuluj</button>
      </div>
    </form>
  );
}
