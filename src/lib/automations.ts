import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Settings } from "@/db/schema";
import { EMAIL_KIND, type EmailKind } from "./email";
import { getSettings } from "./settings";
import { REMINDER_SUBJECT, REMINDER_TEMPLATE, isMailerEnabled } from "./abandoned-core";

/**
 * AUTOMATYZACJE — rejestr maili, które wychodzą same po zdarzeniu (pulpit mailera, 16.10.2026).
 *
 * Jedno miejsce, z którego panel bierze listę automatów, ich treść (do podglądu i edycji)
 * i włącznik. Kod wysyłający pyta tu o treść i o to, czy automat jest włączony —
 * dzięki temu zmiana w panelu działa od następnego maila, bez deployu.
 *
 * Skąd treść:
 *  - `settings` — potwierdzenie zgłoszenia, potwierdzenie zapisu, lead do trenerki
 *    (tam leżały od początku i edytowało się je w Ustawieniach; zostają, żeby nie migrować danych),
 *  - `email_templates` — reszta; brak wiersza = treść domyślna z kodu.
 * Włącznik zawsze w `email_templates.enabled` (brak wiersza = włączony).
 */

export type AutomationKey =
  | typeof EMAIL_KIND.KURSANTKA_POTWIERDZENIE
  | typeof EMAIL_KIND.KURSANTKA_ZAPIS
  | typeof EMAIL_KIND.TRENERKA_LEAD
  | typeof EMAIL_KIND.PORZUCONA_APLIKACJA
  | typeof EMAIL_KIND.AKADEMIA_POWITANIE;

type SettingsFields = { subject: keyof Settings; body: keyof Settings };

export type AutomationDef = {
  key: AutomationKey;
  name: string;
  /** Kiedy wychodzi — jednym zdaniem, po ludzku. */
  trigger: string;
  audience: "kursantka" | "trenerka" | "akademia";
  placeholders: { key: string; label: string }[];
  /** Bez nich mail jest wadliwy (np. link wypisania) — zapis bez nich jest odrzucany. */
  required?: string[];
  sample: Record<string, string>;
  settingsFields?: SettingsFields;
  defaults?: { subject: string; body: string };
  /** Ostrzeżenie przy wyłączaniu — co przestaje działać. */
  offWarning: string;
};

export const AKADEMIA_SUBJECT = "Konto w Uniwersytecie Beauty założone — co dalej";
export const AKADEMIA_TEMPLATE = [
  "Dzień dobry,",
  "",
  "dziękujemy za zgłoszenie akademii {{akademia}}. Konto w panelu jest już aktywne — logujesz się adresem {{email}} i hasłem ustawionym przy rejestracji: {{login_url}}",
  "",
  "Co dzieje się dalej:",
  "",
  "1. Sprawdzamy Twój wpis w Bazie Usług Rozwojowych. Bez niego kursantka nie rozliczy dofinansowania, dlatego robimy to zanim przekażemy pierwszy kontakt.",
  "2. Dzwonimy — zwykle w ciągu 1-2 dni roboczych. Ustalamy zakres szkoleń, region i zasady rozliczenia.",
  "3. Podpisujemy umowę partnerską. Dopiero od tego momentu wolno nam przekazać Ci dane kontaktowe kursantki — wcześniej nie pozwala na to RODO.",
  "",
  "W międzyczasie warto uzupełnić profil akademii w panelu (zakładka „Mój profil”). Korzystamy z niego, dobierając kursantki do akademii — im konkretniej opiszesz zakres, tym trafniej.",
  "",
  "Pozdrawiamy,",
  "Zespół Uniwersytet Beauty",
  "biuro@uniwersytetbeauty.pl",
].join("\n");

const LEAD_SAMPLE = {
  imie: "Anna Kowalska",
  imie_wolacz: "Anno",
  telefon: "500 600 700",
  email: "anna@example.com",
  kategoria: "Stylizacja rzęs",
  wojewodztwo: "Śląskie",
  miasto: "Katowice",
  status_zawodowy: "pracująca",
};

export const AUTOMATIONS: AutomationDef[] = [
  {
    key: EMAIL_KIND.KURSANTKA_POTWIERDZENIE,
    name: "Potwierdzenie zgłoszenia",
    trigger: "Kursantka wysłała aplikację (formularz albo czat) — od razu.",
    audience: "kursantka",
    placeholders: [
      { key: "imie_wolacz", label: "imię w wołaczu (Anno)" },
      { key: "kategoria", label: "kurs" },
      { key: "wojewodztwo", label: "województwo" },
      { key: "miasto", label: "miasto" },
    ],
    sample: LEAD_SAMPLE,
    settingsFields: { subject: "confirmEmailSubject", body: "confirmEmailTemplate" },
    offWarning: "Kursantki przestaną dostawać jakikolwiek sygnał, że zgłoszenie doszło.",
  },
  {
    key: EMAIL_KIND.KURSANTKA_ZAPIS,
    name: "Potwierdzenie zapisu",
    trigger: "Akademia albo biuro oznaczyło kursantkę jako zapisaną.",
    audience: "kursantka",
    placeholders: [
      { key: "imie_wolacz", label: "imię w wołaczu" },
      { key: "kategoria", label: "kurs" },
      { key: "trenerka", label: "nazwa akademii" },
    ],
    sample: { ...LEAD_SAMPLE, trenerka: "Akademia Piękna" },
    settingsFields: { subject: "signupEmailSubject", body: "signupEmailTemplate" },
    offWarning: "Kursantka nie dowie się, że organizacją zajmuje się już akademia. Powiadomienie biura o należności wychodzi dalej.",
  },
  {
    key: EMAIL_KIND.TRENERKA_LEAD,
    name: "Nowy lead do akademii",
    trigger: "System przydzielił kursantkę akademii (dystrybucja leada).",
    audience: "trenerka",
    placeholders: [
      { key: "trenerka", label: "nazwa akademii" },
      { key: "imie", label: "imię i nazwisko kursantki" },
      { key: "telefon", label: "telefon" },
      { key: "email", label: "e-mail" },
      { key: "kategoria", label: "kurs" },
      { key: "wojewodztwo", label: "województwo" },
      { key: "status_zawodowy", label: "status zawodowy" },
    ],
    sample: { ...LEAD_SAMPLE, trenerka: "Akademia Piękna" },
    settingsFields: { subject: "leadEmailSubject", body: "leadEmailTemplate" },
    offWarning: "Akademie nie dostaną maila z danymi kursantki — przydział zobaczą tylko w panelu.",
  },
  {
    key: EMAIL_KIND.PORZUCONA_APLIKACJA,
    name: "Dokończ aplikację",
    trigger: "Kursantka zaczęła aplikację, podała e-mail i zgodę, ale nie skończyła (2 h – 7 dni). Jedno na adres.",
    audience: "kursantka",
    placeholders: [
      { key: "imie", label: "imię w wołaczu" },
      { key: "zakres", label: "zdanie o kursie" },
      { key: "resume", label: "link „dokończ”" },
      { key: "unsub", label: "link wypisania" },
    ],
    required: ["resume", "unsub"],
    sample: {
      imie: "Anno",
      zakres: "Zaczęłaś aplikację na szkolenie z zakresu: Stylizacja rzęs.",
      resume: "https://uniwersytetbeauty.pl/aplikacja?wznow=…",
      unsub: "https://uniwersytetbeauty.pl/wypisz/…",
    },
    defaults: { subject: REMINDER_SUBJECT, body: REMINDER_TEMPLATE },
    offWarning: "Porzucone aplikacje przestaną dostawać przypomnienie.",
  },
  {
    key: EMAIL_KIND.AKADEMIA_POWITANIE,
    name: "Powitanie akademii",
    trigger: "Akademia sama założyła konto na /dla-akademii/rejestracja.",
    audience: "akademia",
    placeholders: [
      { key: "akademia", label: "nazwa akademii" },
      { key: "email", label: "login (e-mail)" },
      { key: "login_url", label: "link do logowania" },
    ],
    sample: { akademia: "Akademia Piękna", email: "kontakt@akademia.pl", login_url: "https://uniwersytetbeauty.pl/panel/login" },
    defaults: { subject: AKADEMIA_SUBJECT, body: AKADEMIA_TEMPLATE },
    offWarning: "Akademia po rejestracji nie dostanie maila z instrukcją. Powiadomienie dla biura wychodzi dalej.",
  },
];

export function automationDef(key: string): AutomationDef | undefined {
  return AUTOMATIONS.find((a) => a.key === key);
}

export type ResolvedAutomation = { subject: string; body: string; enabled: boolean; customized: boolean };

async function overrideRow(key: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.kind, key)).limit(1);
  return row ?? null;
}

export async function resolveAutomation(key: AutomationKey, settings?: Settings): Promise<ResolvedAutomation> {
  const def = automationDef(key)!;
  const row = await overrideRow(key);
  const enabled = row?.enabled ?? true;
  if (def.settingsFields) {
    const s = settings ?? (await getSettings());
    return {
      subject: String(s[def.settingsFields.subject]),
      body: String(s[def.settingsFields.body]),
      enabled,
      customized: false,
    };
  }
  return {
    subject: row?.subject ?? def.defaults!.subject,
    body: row?.body ?? def.defaults!.body,
    enabled,
    customized: Boolean(row?.subject || row?.body),
  };
}

/** Czy automat ma wychodzić. Błąd bazy = włączony: mail transakcyjny ważniejszy niż wyłącznik. */
export async function isAutomationEnabled(key: AutomationKey): Promise<boolean> {
  try {
    if (key === EMAIL_KIND.PORZUCONA_APLIKACJA && !isMailerEnabled()) return false;
    return (await overrideRow(key))?.enabled ?? true;
  } catch (err) {
    console.error("[automations] Nie udało się odczytać włącznika:", err);
    return true;
  }
}

/** Placeholdery, których brakuje w treści, a są wymagane. */
export function missingRequired(def: AutomationDef, subject: string, body: string): string[] {
  return (def.required ?? []).filter((k) => !`${subject}\n${body}`.includes(`{{${k}}}`));
}

export async function saveAutomation(
  key: AutomationKey,
  data: { subject?: string; body?: string; enabled?: boolean; reset?: boolean },
  actor: string
): Promise<void> {
  const def = automationDef(key)!;
  const db = await getDb();

  if (def.settingsFields && (data.subject !== undefined || data.body !== undefined)) {
    await getSettings(); // zakłada wiersz, jeśli go brak
    const patch: Record<string, string> = {};
    if (data.subject !== undefined) patch[def.settingsFields.subject] = data.subject;
    if (data.body !== undefined) patch[def.settingsFields.body] = data.body;
    await db.update(schema.settings).set(patch).where(eq(schema.settings.id, 1));
  }

  const existing = await overrideRow(key);
  const values = {
    kind: key,
    // Treści z `settings` nie dublujemy w `email_templates` — tam trzymamy tylko włącznik.
    subject: def.settingsFields ? null : data.reset ? null : (data.subject ?? existing?.subject ?? null),
    body: def.settingsFields ? null : data.reset ? null : (data.body ?? existing?.body ?? null),
    enabled: data.enabled ?? existing?.enabled ?? true,
    updatedBy: actor,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.emailTemplates)
    .values(values)
    .onConflictDoUpdate({ target: schema.emailTemplates.kind, set: values });
}
