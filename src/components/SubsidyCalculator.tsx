"use client";

import { useState } from "react";
import Link from "next/link";
import { SUBSIDY_MAX_PERCENT } from "@/lib/constants";

/**
 * 13.09.2026: przebudowany bez cen. Wcześniej licznik przyjmował cenę kursu (suwak 1–15 tys. zł)
 * i pokazywał kwotę dopłaty w złotych — to dokładnie ten mechanizm, który miał zniknąć razem
 * z resztą cen w serwisie (decyzja właściciela o chowaniu cen przed startem kampanii). Nowa
 * wersja pokazuje WYŁĄCZNIE poziom procentowy programu — żadnej matematyki w złotówkach.
 * Dokładną kwotę dopłaty kandydatka poznaje po quizie, od nas, nie z suwaka na stronie.
 */
const PROGRAMS = [
  { id: "bur", label: "Baza Usług Rozwojowych (BUR)", percent: SUBSIDY_MAX_PERCENT, note: "Dla pracujących, studentek, przedsiębiorczyń i mam — nie musisz być bezrobotna." },
  { id: "up", label: "Powiatowy Urząd Pracy", percent: 85, note: "Dla osób zarejestrowanych jako bezrobotne lub poszukujące pracy." },
  { id: "kfs", label: "Krajowy Fundusz Szkoleniowy (przez pracodawcę)", percent: 80, note: "Wniosek składa Twój pracodawca — dla osób zatrudnionych na umowę o pracę." },
];

export function SubsidyCalculator() {
  const [programId, setProgramId] = useState("bur");
  const program = PROGRAMS.find((p) => p.id === programId)!;

  return (
    <div className="card mx-auto max-w-2xl p-6 md:p-8">
      <div>
        <label className="label" htmlFor="calc-program">Program dofinansowania</label>
        <select id="calc-program" value={programId} onChange={(e) => setProgramId(e.target.value)} className="input">
          {PROGRAMS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* WYNIK — zielony box (pieniądze), świadomie bez kwoty w złotych */}
      <div className="mt-6 rounded-[12px] bg-money-bg p-6 text-center" aria-live="polite">
        <p className="font-serif text-5xl font-bold text-money">do {program.percent}%</p>
        <p className="mt-2 text-ink-soft">ceny szkolenia pokrytej dofinansowaniem</p>
        <p className="mt-3 text-sm text-muted">{program.note}</p>
      </div>

      <Link href="/quiz" className="btn-primary mt-6 w-full">
        Sprawdź swoje dofinansowanie →
      </Link>
    </div>
  );
}
