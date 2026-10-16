"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DUR, EASE_OUT } from "@/lib/motion-tokens";

/** Krótki komunikat w rogu ekranu po zapisie. Znika sam po ~2,5 s. */
export function Toast({ message, tone = "ok", onDone }: { message: string | null; tone?: "ok" | "error"; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[60]">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: DUR.enter, ease: EASE_OUT }}
            className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
              tone === "ok" ? "bg-ink-soft text-white" : "bg-red-600 text-white"
            }`}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
