/**
 * KANAŁ APLIKACJI — formularz `/aplikacja` czy czat „Hania" w rogu strony.
 *
 * Oba wysyłają lead z `source: "quiz"` (to ta sama aplikacja, ten sam payload z `lib/quiz-form.ts`),
 * więc kanału nie trzymamy w enumie bazy — rozróżnia go pierwsza linia `message`, którą dopisuje
 * czat. Dzięki temu nie było migracji, a stare leady z quizu same lądują jako „Aplikacja".
 * Porzucone sesje czatu mają `answers.kanal = "czat"` (`/api/quiz-progress`).
 *
 * Plik bez importu bazy — używa go też czat po stronie przeglądarki. Warunki SQL żyją w panelu.
 *
 * ⚠️ `CHAT_CHANNEL_NOTE` jest kluczem, nie ozdobnikiem: zmiana tekstu bez zmiany prefiksu
 * w `CHAT_PREFIX` przerzuci nowe leady z czatu do „Aplikacji".
 */
export const CHAT_CHANNEL_NOTE = "Kanał: czat na stronie (doradca)";
export const CHAT_PREFIX = "Kanał: czat";

export type Kanal = "aplikacja" | "czat";

export const KANAL_LABELS: Record<Kanal, string> = { aplikacja: "Aplikacja", czat: "Czat" };

/** Kanał leada z quizu; `null` dla innych źródeł (karta kursu, konsultacja, landing). */
export function kanalLeada(lead: { source: string; message: string | null }): Kanal | null {
  if (lead.source !== "quiz") return null;
  return lead.message?.startsWith(CHAT_PREFIX) ? "czat" : "aplikacja";
}

export function kanalSesji(sesja: { answers: Record<string, unknown> | null }): Kanal {
  return sesja.answers?.kanal === "czat" ? "czat" : "aplikacja";
}
