"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/tracking-events";

/** Klucz w sessionStorage, pod którym `LeadForm`/`Quiz` zostawiają dane do segmentacji konwersji. */
export const LEAD_SEGMENT_KEY = "ub_lead_segment";

type Segment = {
  /** Skąd przyszedł lead — pozwala odróżnić w Mecie zgłoszenia z quizu od pozostałych. */
  source?: string;
  voivodeship?: string;
  category?: string;
  /** UUID wygenerowany PRZED wysłaniem formularza — ten sam idzie do `/api/lead` (CAPI)
   * i tutaj do `fbq(...,{eventID})`/`transaction_id` Ads. Deduplikacja Meta/Ads. */
  eventId?: string;
  /**
   * Surowe dane kontaktowe DLA Google Ads enhanced conversions — WYŁĄCZNIE gdy formularz
   * zapisał je (czyli była zgoda marketingowa z banera w chwili wysyłki). Google sam je
   * hashuje po stronie `gtag` (`gtag('set','user_data',...)`) — my nie hashujemy, nie
   * wysyłamy nigdzie indziej i kasujemy z pamięci od razu po odczycie (patrz niżej).
   */
  email?: string;
  phone?: string;
};

/**
 * Konwersja `Lead` na /dziekujemy wzbogacona o województwo i kategorię szkolenia.
 *
 * Po co: bez tych dwóch pól w GA4 i Mecie widać tylko „ile leadów", a nie „skąd i na co".
 * Województwo jest u nas DEKLAROWANE w formularzu, więc jest dokładniejsze niż geolokalizacja
 * po IP, którą GA4 zgaduje. To ono decyduje o operatorze dofinansowania, więc jest kluczem
 * do decyzji, które województwo skalować w kampanii.
 *
 * Świadomie przekazujemy do zdarzeń GA4/Meta tylko województwo i kategorię (dane deklarowane,
 * nieosobowe) — bez statusu zawodowego (Meta traktuje zatrudnienie jako kategorię wrażliwą).
 *
 * 🔴 POPRAWKA 29.09.2026: poprzednia wersja renderowała `<TrackEvent event="Lead">`
 * BEZWARUNKOWO, nawet gdy w `sessionStorage` nie było segmentu (bo sesja go już skasowała
 * przy poprzednim odczycie). Efekt: KAŻDE odświeżenie/powrót na `/dziekujemy` wysyłało
 * drugi `Lead` i drugą konwersję Google Ads — naruszało to kryterium akceptacji #6.
 * Teraz: brak segmentu (albo brak w nim `eventId`) = nic się nie wysyła.
 */
export function LeadConversion() {
  const [segment, setSegment] = useState<Segment | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LEAD_SEGMENT_KEY);
      if (raw) {
        setSegment(JSON.parse(raw) as Segment);
        // Czyścimy od razu: odświeżenie /dziekujemy nie ma udawać kolejnego leada, a e-mail/telefon
        // (jeśli tam trafiły — patrz typ `Segment`) nie mają leżeć w storage dłużej niż moment odczytu.
        sessionStorage.removeItem(LEAD_SEGMENT_KEY);
      }
    } catch {
      /* brak storage — lecimy bez segmentacji, czyli BEZ konwersji (patrz niżej) */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Brak segmentu ALBO brak eventId (stary klient, storage padł) = nie wiemy, że to świeże
    // zgłoszenie z TEGO przejścia — nie strzelamy w ciemno.
    if (!segment?.eventId) return;

    trackEvent(
      "lead",
      {
        ...(segment.voivodeship ? { wojewodztwo: segment.voivodeship } : {}),
        ...(segment.category ? { kategoria: segment.category } : {}),
        source: segment.source,
      },
      {
        eventId: segment.eventId,
        // Google Ads enhanced conversions: dane kontaktowe SUROWE, TYLKO gdy formularz je
        // zapisał (czyli była zgoda marketingowa w chwili wysyłki — `LeadForm.tsx`/`Quiz.tsx`).
        // `trackEvent` woła `gtag('set','user_data',...)` tuż przed konwersją Ads; gtag hashuje sam.
        ...(segment.email && segment.phone ? { adsUserData: { email: segment.email, phone: segment.phone } } : {}),
      }
    );
  }, [ready, segment]);

  return null;
}
