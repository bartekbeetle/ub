"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Odpala event Meta Pixel po stronie klienta (Lead na /dziekujemy, ViewContent na kursie). */
export function TrackEvent({ event, params }: { event: string; params?: Record<string, unknown> }) {
  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", event, params ?? {});
    }
  }, [event, params]);
  return null;
}
