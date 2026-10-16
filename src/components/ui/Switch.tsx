"use client";

import { motion } from "motion/react";
import { SPRING } from "@/lib/motion-tokens";

/** Przełącznik on/off ze sprężystą gałką (tokeny ruchu). Tylko transform — bez animacji szerokości. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`press relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-gray-300"
      }`}
    >
      <motion.span
        className="absolute left-1 h-5 w-5 rounded-full bg-white shadow"
        animate={{ x: checked ? 20 : 0 }}
        transition={SPRING}
      />
    </button>
  );
}
