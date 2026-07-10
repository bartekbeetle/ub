"use client";

import { useState } from "react";

/** RODO: dane kontaktowe maskowane — odkrycie wymaga świadomego kliknięcia. */
export function RevealContact({ masked, full }: { masked: string; full: string }) {
  const [revealed, setRevealed] = useState(false);
  if (revealed) return <span className="select-all">{full}</span>;
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      title="Kliknij, aby odkryć dane"
      className="cursor-pointer rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-muted hover:bg-sand-100"
    >
      {masked}
    </button>
  );
}
