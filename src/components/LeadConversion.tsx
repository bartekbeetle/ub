"use client";

import { useEffect, useState } from "react";
import { TrackEvent } from "@/components/TrackEvent";

/** Klucz w sessionStorage, pod którym `LeadForm` zostawia dane do segmentacji konwersji. */
export const LEAD_SEGMENT_KEY = "ub_lead_segment";

type Segment = {
  /** Skąd przyszedł lead — pozwala odróżnić w Mecie zgłoszenia z quizu od pozostałych. */
  source?: string; voivodeship?: string; category?: string };

/**
 * Konwersja `Lead` na /dziekujemy wzbogacona o województwo i kategorię szkolenia.
 *
 * Po co: bez tych dwóch pól w GA4 i Mecie widać tylko „ile leadów", a nie „skąd i na co".
 * Województwo jest u nas DEKLAROWANE w formularzu, więc jest dokładniejsze niż geolokalizacja
 * po IP, którą GA4 zgaduje. To ono decyduje o operatorze dofinansowania, więc jest kluczem
 * do decyzji, które województwo skalować w kampanii.
 *
 * Świadomie przekazujemy tylko te dwa pola — bez danych kontaktowych i bez statusu
 * zawodowego (Meta traktuje zatrudnienie jako kategorię wrażliwą).
 */
export function LeadConversion() {
  const [segment, setSegment] = useState<Segment | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LEAD_SEGMENT_KEY);
      if (raw) {
        setSegment(JSON.parse(raw) as Segment);
        // Czyścimy od razu: odświeżenie /dziekujemy nie ma udawać kolejnego leada.
        sessionStorage.removeItem(LEAD_SEGMENT_KEY);
      }
    } catch {
      /* brak storage — lecimy bez segmentacji */
    }
    setReady(true);
  }, []);

  // Czekamy na odczyt, żeby nie wysłać zdarzenia zanim poznamy parametry.
  if (!ready) return null;

  return (
    <TrackEvent
      event="Lead"
      params={{
        ...(segment?.voivodeship ? { wojewodztwo: segment.voivodeship } : {}),
        ...(segment?.category ? { kategoria: segment.category } : {}),
        // `content_name` jest standardowym parametrem Meta — dzięki niemu w Menedżerze Reklam
        // widać wprost, że to konwersja z quizu, a nie z innego wejścia.
        content_name: segment?.source === "quiz" ? "quiz-kwalifikacyjny" : "formularz",
      }}
    />
  );
}
