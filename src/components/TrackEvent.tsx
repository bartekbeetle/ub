"use client";

import { useEffect } from "react";
import { trackEvent, type TrackKey } from "@/lib/tracking-events";

/**
 * Cienki wrapper na `trackEvent` (patrz `src/lib/tracking-events.ts`) — jedna mapa zdarzeń
 * dla całej apki. `event` jest teraz KLUCZEM WEWNĘTRZNYM (np. `"lead"`, `"view_item"`), nie
 * nazwą zdarzenia Meta — nazwy dla Meta/GA4/Ads są rozstrzygane w mapie, nie tutaj.
 *
 * `eventId` (opcjonalny UUID) idzie do `fbq(...,{eventID})` i do `transaction_id` konwersji
 * Google Ads — to jest deduplikacja klient/serwer (Meta CAPI) i klient/klient (odświeżenie
 * strony), patrz `docs/zdarzenia-analityczne.md`.
 */
export function TrackEvent({
  event,
  params,
  eventId,
}: {
  event: TrackKey;
  params?: Record<string, unknown>;
  eventId?: string;
}) {
  useEffect(() => {
    trackEvent(event, params ?? {}, { eventId });
    // `params` świadomie POZA listą zależności: obiekt dostaje nową referencję przy każdym
    // renderze rodzica, a odpalenie ma zależeć od zdarzenia/ID, nie od tożsamości obiektu.
    // Deduplikacja po `eventId` (w `trackEvent`) i tak chroni przed powtórką.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, eventId]);

  return null;
}
