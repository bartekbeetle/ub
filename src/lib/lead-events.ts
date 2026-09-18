import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { EMAIL_KIND, renderTemplate, sendOrQueueEmail } from "./email";
import { greetingName } from "./template";
import { getSettings } from "./settings";
import { voivodeshipName } from "./constants";

/**
 * Zdarzenia w cyklu życia leada, które powodują wysyłkę maili.
 *
 * Dlaczego osobny moduł: status „zapisana" ustawia się z TRZECH niezależnych tras API
 * (panel trenerki, admin→przydział, admin→lead). Gdyby wysyłka była wklejona w każdą
 * z nich, to (a) rozjechałaby się przy pierwszej zmianie treści, (b) kursantka dostałaby
 * kilka maili, gdy trenerka i admin oznaczą ten sam zapis. Tu jest jedno miejsce,
 * a idempotencję pilnuje `kind` w kolejce maili.
 *
 * Wszystkie funkcje są „miękkie": łapią własne błędy i nigdy nie wywracają żądania,
 * w którym zostały wywołane. Mail to skutek uboczny zapisu, nie jego warunek.
 */

type LeadRow = typeof schema.leads.$inferSelect;

function leadVars(lead: LeadRow, extra: Record<string, string> = {}) {
  return {
    // `imie` to pełne „imię i nazwisko" — tak działa pole w formularzu i tego oczekuje
    // istniejący szablon maila do trenerki (tam nazwisko jest potrzebne).
    imie: lead.name,
    // Do powitania w mailu DO KURSANTKI: sam pierwszy człon, w wołaczu.
    imie_wolacz: greetingName(lead.name),
    telefon: lead.phone,
    email: lead.email,
    kategoria: lead.category,
    wojewodztwo: voivodeshipName(lead.voivodeship),
    miasto: lead.city ?? "",
    status_zawodowy: lead.employmentStatus,
    ...extra,
  };
}

/**
 * Potwierdzenie przyjęcia zgłoszenia — wysyłane do KURSANTKI zaraz po zapisaniu leada.
 *
 * To domyka najstarszą dziurę lejka: do 18.09.2026 kobieta zostawiała telefon, zgadzała się
 * na kontakt i nie dostawała żadnego sygnału, że zgłoszenie w ogóle doszło.
 */
export async function sendLeadConfirmation(lead: LeadRow): Promise<void> {
  try {
    const settings = await getSettings();
    const vars = leadVars(lead);
    await sendOrQueueEmail({
      to: lead.email,
      subject: renderTemplate(settings.confirmEmailSubject, vars),
      body: renderTemplate(settings.confirmEmailTemplate, vars),
      leadId: lead.id,
      kind: EMAIL_KIND.KURSANTKA_POTWIERDZENIE,
    });
  } catch (err) {
    console.error("[lead-events] Nie udało się wysłać potwierdzenia zgłoszenia:", err);
  }
}

/**
 * Kursantka została oznaczona jako zapisana. Wysyła dwa maile:
 *  1. do kursantki — potwierdzenie i informacja, że organizacja jest po stronie akademii,
 *  2. do nas (notifyEmail) — bo to moment powstania należności (pay-per-result).
 *
 * `trainerName` podaj, jeśli masz go pod ręką w wywołującej trasie; gdy go brak,
 * dociągamy nazwę z najnowszego przydziału o statusie „zapisana".
 */
export async function onLeadSigned(params: {
  leadId: number;
  trainerName?: string | null;
  actor: string;
}): Promise<void> {
  try {
    const db = await getDb();
    const [lead] = await db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, params.leadId))
      .limit(1);
    if (!lead) return;

    // Lead zanonimizowany na żądanie RODO nie ma już adresu — nie ma dokąd pisać.
    if (!lead.email) return;

    let trainerName = params.trainerName ?? null;
    let amount: number | null = null;

    const assignments = await db
      .select({ assignment: schema.leadAssignments, trainer: schema.trainers })
      .from(schema.leadAssignments)
      .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
      .where(
        and(
          eq(schema.leadAssignments.leadId, params.leadId),
          inArray(schema.leadAssignments.status, ["zapisana"])
        )
      )
      .orderBy(desc(schema.leadAssignments.id))
      .limit(1);

    if (assignments[0]) {
      trainerName = trainerName ?? assignments[0].trainer.name;
      amount = assignments[0].assignment.amount ?? null;
    }

    const settings = await getSettings();
    const vars = leadVars(lead, { trenerka: trainerName ?? "szkoleniowa" });

    await sendOrQueueEmail({
      to: lead.email,
      subject: renderTemplate(settings.signupEmailSubject, vars),
      body: renderTemplate(settings.signupEmailTemplate, vars),
      leadId: lead.id,
      kind: EMAIL_KIND.KURSANTKA_ZAPIS,
    });

    // Powiadomienie wewnętrzne — świadomie bez szablonu w ustawieniach: to jest sygnał
    // operacyjny dla nas, nie treść dla klienta, więc nie ma czego edytować w panelu.
    await sendOrQueueEmail({
      to: settings.notifyEmail,
      subject: `Kursantka zapisana — ${lead.category}, ${voivodeshipName(lead.voivodeship)}`,
      body: [
        "Kursantka została oznaczona jako zapisana — powstała należność do rozliczenia.",
        "",
        `Lead: #${lead.id} ${lead.name}`,
        `Kategoria: ${lead.category}`,
        `Województwo: ${voivodeshipName(lead.voivodeship)}`,
        `Akademia: ${trainerName ?? "(nieustalona)"}`,
        amount !== null ? `Kwota: ${amount} zł` : "Kwota: (nie naliczona — sprawdź model rozliczenia)",
        `Oznaczył(a): ${params.actor}`,
        "",
        "Rozliczenia: /admin/rozliczenia",
      ].join("\n"),
      leadId: lead.id,
      kind: EMAIL_KIND.WEWNETRZNE_ZAPIS,
    });
  } catch (err) {
    console.error("[lead-events] Nie udało się obsłużyć zdarzenia zapisu:", err);
  }
}
