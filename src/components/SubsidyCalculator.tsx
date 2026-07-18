"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPln } from "@/lib/utils";

const PROGRAMS = [
  { id: "bur", label: "BUR — do 90%", percent: 90 },
  { id: "up", label: "Powiatowy Urząd Pracy — 85%", percent: 85 },
  { id: "kfs", label: "KFS (przez pracodawcę) — 80%", percent: 80 },
];

export function SubsidyCalculator() {
  const [price, setPrice] = useState(4000);
  const [programId, setProgramId] = useState("bur");
  const program = PROGRAMS.find((p) => p.id === programId)!;
  const subsidy = Math.round((price * program.percent) / 100);
  const toPay = price - subsidy;

  return (
    <div className="card mx-auto max-w-2xl p-6 md:p-8">
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="calc-price" className="label !mb-0">Cena kursu</label>
          <output htmlFor="calc-price" className="font-serif text-2xl font-bold text-ink-soft">
            {formatPln(price)}
          </output>
        </div>
        <input
          id="calc-price"
          type="range"
          min={1000}
          max={15000}
          step={100}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-sand-100 accent-sand-500"
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>1 000 zł</span>
          <span>15 000 zł</span>
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="calc-program" className="label">Program dofinansowania</label>
        <select id="calc-program" value={programId} onChange={(e) => setProgramId(e.target.value)} className="input">
          {PROGRAMS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* WYNIK — zielony box (pieniądze) */}
      <div className="mt-6 rounded-[12px] bg-money-bg p-6 text-center" aria-live="polite">
        <p className="text-sm font-semibold text-money-dark">
          Dofinansowanie ({program.percent}%): <span className="text-lg">{formatPln(subsidy)}</span>
        </p>
        <p className="mt-2 text-ink-soft">Zapłacisz tylko:</p>
        <p className="font-serif text-5xl font-bold text-money">{formatPln(toPay)}</p>
      </div>

      <Link href="/kursy" className="btn-primary mt-6 w-full">
        Znajdź kurs z dofinansowaniem →
      </Link>
    </div>
  );
}
