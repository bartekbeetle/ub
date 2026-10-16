import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DEFAULT_MAX_EMAIL_AGE_DAYS, EMAIL_KIND, deliver, isSmtpConfigured, renderTemplate } from "./email";
import { greetingName } from "./template";
import { voivodeshipName } from "./constants";
import { formatDate } from "./utils";

/**
 * ZALEGŁE POTWIERDZENIA ZGŁOSZEŃ — jednorazowe domknięcie dziury z 18.09–08.10.2026.
 *
 * Potwierdzenia dla kursantek kolejkowały się od 18.09, ale SMTP ruszył dopiero 08.10.
 * Cron wysyła tylko maile młodsze niż 7 dni (`DEFAULT_MAX_EMAIL_AGE_DAYS`), więc zgłoszenia
 * sprzed 01.10 nigdy nie dostały żadnej odpowiedzi — a co najmniej jedna kursantka (Zosia, lead #22)
 * pytała formularzem, czy aplikacja w ogóle doszła.
 *
 * Dlaczego NIE puszczamy po prostu `?maxAgeDays=0`:
 *  1. to wysłałoby też stare powiadomienia „nowy lead” do trenerek z lipca (patrz komentarz
 *     przy `DEFAULT_MAX_EMAIL_AGE_DAYS`),
 *  2. zakolejkowana treść obiecuje „akademia zadzwoni w ciągu 1-2 dni” — po trzech tygodniach
 *     to nieprawda. Spóźniony mail dostaje własną, uczciwą treść: przeprosiny, „zgłoszenie jest
 *     u nas”, bez terminu i bez obietnicy telefonu.
 *
 * Treść podmieniamy w wierszu kolejki przed wysyłką, więc historia w bazie pokazuje to,
 * co kursantka naprawdę dostała.
 */

export const OVERDUE_CONFIRM_SUBJECT = "Twoje zgłoszenie do nas dotarło — {{kategoria}}";

// ⚠️ Guardrail UB: nigdy „0 zł” — dofinansowanie „nawet do 95%” z warunkiem.
export const OVERDUE_CONFIRM_TEMPLATE = [
  "Dzień dobry {{imie_wolacz}},",
  "",
  "{{data_zgloszenia}} wysłałaś do nas zgłoszenie na szkolenie z zakresu: {{kategoria}} ({{wojewodztwo}}). Potwierdzenie powinno przyjść do Ciebie od razu, ale przez awarię naszej wysyłki maili dochodzi dopiero dziś. Przepraszamy.",
  "",
  "Twoje zgłoszenie jest u nas i nic nie przepadło. Szukamy dla Ciebie akademii w Twoim regionie, która prowadzi ten kurs i ma wpis do Bazy Usług Rozwojowych. Odezwiemy się, gdy będziemy mieć konkretną akademię i termin.",
  "",
  "O dofinansowaniu: wsparcie z Bazy Usług Rozwojowych sięga nawet 95% ceny szkolenia, a jego wysokość zależy od województwa, aktualnego naboru i Twojej sytuacji zawodowej.",
  "",
  "Jeśli w międzyczasie znalazłaś już szkolenie albo chcesz wycofać zgodę na kontakt, po prostu odpisz na tę wiadomość.",
  "",
  "Pozdrawiamy,",
  "Zespół Uniwersytet Beauty",
  "biuro@uniwersytetbeauty.pl · uniwersytetbeauty.pl",
].join("\n");

export type OverdueItem = {
  queueId: number;
  leadId: number;
  to: string;
  queuedAt: string;
  action: "wyslij" | "pomin";
  reason?: string;
  subject?: string;
  body?: string;
};

/**
 * `dryRun: true` niczego nie zmienia i nie wysyła — zwraca listę adresatów z gotową treścią,
 * żeby przed wysyłką było widać, kto i co dostanie.
 */
export async function sendOverdueConfirmations(opts: { dryRun: boolean; limit?: number }): Promise<{
  ok: boolean;
  dryRun: boolean;
  sent: number;
  failed: number;
  items: OverdueItem[];
  error?: string;
}> {
  if (!opts.dryRun && !isSmtpConfigured()) {
    return { ok: false, dryRun: false, sent: 0, failed: 0, items: [], error: "SMTP nieskonfigurowane." };
  }

  const db = await getDb();
  const cutoff = new Date(Date.now() - DEFAULT_MAX_EMAIL_AGE_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ q: schema.emailQueue, lead: schema.leads })
    .from(schema.emailQueue)
    .innerJoin(schema.leads, eq(schema.emailQueue.leadId, schema.leads.id))
    .where(
      and(
        eq(schema.emailQueue.kind, EMAIL_KIND.KURSANTKA_POTWIERDZENIE),
        inArray(schema.emailQueue.status, ["w_kolejce", "blad"]),
        lt(schema.emailQueue.createdAt, cutoff)
      )
    )
    .orderBy(schema.emailQueue.createdAt)
    .limit(opts.limit ?? 100);

  // Adresy, które już dostały potwierdzenie (np. drugi lead tej samej osoby po 01.10).
  const sentRows = await db
    .select({ to: schema.emailQueue.toEmail })
    .from(schema.emailQueue)
    .where(and(eq(schema.emailQueue.kind, EMAIL_KIND.KURSANTKA_POTWIERDZENIE), eq(schema.emailQueue.status, "wyslany")));
  const done = new Set(sentRows.map((r) => r.to.trim().toLowerCase()));
  const batch = new Set<string>();

  const items: OverdueItem[] = [];
  let sent = 0;
  let failed = 0;

  for (const { q, lead } of rows) {
    const base = { queueId: q.id, leadId: lead.id, to: lead.email, queuedAt: q.createdAt.toISOString() };
    const addr = (lead.email ?? "").trim().toLowerCase();

    const skip = lead.anonymizedAt
      ? "dane usunięte (RODO)"
      : !addr
        ? "brak adresu"
        : lead.status === "odrzucony"
          ? "lead odrzucony"
          : lead.status === "zapisana" || lead.status === "rozliczony"
            ? "już zapisana na szkolenie"
            : done.has(addr)
              ? "ten adres dostał już potwierdzenie"
              : batch.has(addr)
                ? "duplikat adresu w tej partii"
                : null;
    if (skip) {
      items.push({ ...base, action: "pomin", reason: skip });
      continue;
    }
    // Duplikat tej samej osoby w tej samej partii — jeden mail na adres.
    batch.add(addr);

    const vars = {
      imie_wolacz: greetingName(lead.name),
      kategoria: lead.category,
      wojewodztwo: voivodeshipName(lead.voivodeship),
      data_zgloszenia: formatDate(lead.createdAt).replace(/ \d{4}$/, ""),
    };
    const subject = renderTemplate(OVERDUE_CONFIRM_SUBJECT, vars);
    const body = renderTemplate(OVERDUE_CONFIRM_TEMPLATE, vars);
    items.push({ ...base, action: "wyslij", subject, body });

    if (opts.dryRun) continue;

    await db
      .update(schema.emailQueue)
      .set({ subject, body, toEmail: lead.email })
      .where(eq(schema.emailQueue.id, q.id));
    const res = await deliver({ ...q, subject, body, toEmail: lead.email });
    if (res.sent) sent++;
    else failed++;
  }

  return { ok: true, dryRun: opts.dryRun, sent, failed, items };
}
