import { redirect } from "next/navigation";

/**
 * Ekran „Porzucone quizy" został wchłonięty przez `/admin/kursantki` (18.09.2026).
 *
 * Powód: porzucona aplikacja, zgłoszenie i lead to trzy etapy drogi TEJ SAMEJ kobiety.
 * Rozdzielone na dwie zakładki nie dawały odpowiedzi na jedyne pytanie, które ma tu
 * znaczenie — gdzie ucieka pieniądz. Teraz jest jeden lejek i jedna tabela pod nim.
 *
 * Trasa zostaje jako przekierowanie, a nie 404: ten adres siedzi w historii przeglądarki
 * i w zakładkach.
 */
export default function PorzuconePage() {
  redirect("/admin/kursantki?etap=porzucone");
}
