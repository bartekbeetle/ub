import { z } from "zod";
import {
  CATEGORIES,
  EMPLOYMENT_STATUSES,
  VOIVODESHIPS,
  LEVELS,
  MODES,
  BLOG_CATEGORIES,
  PROSPECT_STATUSES,
  PROSPECT_PRIORITIES,
  PROSPECT_SOURCES,
  PROSPECT_ACTIVITY_TYPES,
  BUR_SEGMENTS,
  RESEARCH_JOB_STATUSES,
} from "./constants";

const voivodeshipSlugs = VOIVODESHIPS.map((v) => v.slug) as [string, ...string[]];

/**
 * Zamienia błąd zod na komunikat, z którego admin coś wie: nazwa pola + powód.
 * Samo "Nieprawidłowe dane." nie mówi, które z ~20 pól formularza jest do poprawki.
 */
export function zodErrorMessage(error: z.ZodError): string {
  const issue = error.errors[0];
  if (!issue) return "Nieprawidłowe dane.";
  const field = issue.path.join(".");
  return field ? `Pole "${field}": ${issue.message}` : issue.message;
}

export const leadSchema = z.object({
  name: z.string().trim().min(3, "Podaj imię i nazwisko").max(160),
  phone: z
    .string()
    .trim()
    .min(9, "Podaj poprawny numer telefonu")
    .max(20)
    .regex(/^[+\d\s-]+$/, "Podaj poprawny numer telefonu"),
  email: z.string().trim().email("Podaj poprawny adres email").max(255),
  voivodeship: z.enum(voivodeshipSlugs, { errorMap: () => ({ message: "Wybierz województwo" }) }),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Wybierz kategorię szkolenia" }),
  }),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Wybierz status zawodowy" }),
  }),
  preferredDate: z.string().trim().max(120).optional().or(z.literal("")),
  // === Pola miękkie z quizu kwalifikacyjnej (/aplikacja) — wszystkie opcjonalne, wszystkie
  // mapują na kolumny, które już istnieją w `leads` (patrz src/db/schema.ts) i były
  // dotąd zasilane tylko z panelu recepcjonistki. Żadna migracja nie jest potrzebna.
  city: z.string().trim().max(120).optional().or(z.literal("")),
  hasBusinessActivity: z.boolean().optional(),
  /** Km, na jakie kandydatka jest gotowa dojechać na szkolenie. */
  travelKm: z.coerce.number().int().min(0).max(999).optional(),
  /**
   * Wolny tekst na pola, które NIE mają własnej kolumny (cel zgłoszenia, przedział wiekowy,
   * czy pracuje już w beauty, skąd się dowiedziała) — składany w quizie w jeden czytelny blok,
   * zapisywany w `leads.message`. Świadomie NIE rozbijamy tego na kolejne kolumny: to są dane
   * miękkie do lektury przez trenerkę/admina, nie pola do filtrowania czy matchingu.
   */
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Zgody rozdzielone — patrz komentarz przy tabeli `leads` w src/db/schema.ts.
  rodoConsent: z.literal(true, {
    errorMap: () => ({ message: "Zgoda na przekazanie danych trenerkom jest wymagana" }),
  }),
  contactConsent: z.literal(true, {
    errorMap: () => ({ message: "Zgoda na kontakt w sprawie aplikacji jest wymagana" }),
  }),
  marketingConsent: z.boolean().optional().default(false),
  courseId: z.number().int().positive().optional().nullable(),
  source: z.enum(["kurs", "landing", "konsultacja", "quiz"]).default("landing"),
  utmSource: z.string().max(120).optional().or(z.literal("")),
  utmMedium: z.string().max(120).optional().or(z.literal("")),
  utmCampaign: z.string().max(160).optional().or(z.literal("")),
  // honeypot — bot wypełnia, człowiek nie; handler zwraca cichy "sukces" bez zapisu
  website: z.string().max(300).optional().or(z.literal("")),
});

export const submissionSchema = z.object({
  type: z.enum(["kontakt", "konsultacja"]),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  website: z.string().max(300).optional().or(z.literal("")),
});

/**
 * Konwersja zgłoszenia na leada („Uzupełnij do leada" w panelu).
 *
 * Celowo powiela twarde reguły `leadSchema` zamiast być jego `.partial()`:
 * lead powstały z rozmowy telefonicznej musi spełniać DOKŁADNIE te same warunki,
 * co lead z formularza kwalifikacyjnego, bo idzie tą samą drogą do trenerki.
 *
 * `rodoConsent: z.literal(true)` jest tu sednem sprawy — zgłoszenie miało zgodę
 * tylko na kontakt z nami. Bez odrębnej zgody na przekazanie danych trenerce
 * konwersja NIE MOŻE przejść, i pilnuje tego serwer, nie checkbox w przeglądarce.
 */
export const submissionConversionSchema = z.object({
  // Imię i telefon są edytowalne: zgłoszenie bywa niepełne (telefon jest nullowalny,
  // imię bywa jednoczłonowe), a lead wymaga kompletu. Admin uzupełnia je z rozmowy.
  name: z.string().trim().min(3, "Podaj imię i nazwisko").max(160),
  phone: z
    .string()
    .trim()
    .min(9, "Podaj poprawny numer telefonu")
    .max(20)
    .regex(/^[+\d\s-]+$/, "Podaj poprawny numer telefonu"),
  voivodeship: z.enum(voivodeshipSlugs, { errorMap: () => ({ message: "Wybierz województwo" }) }),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Wybierz kategorię szkolenia" }),
  }),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Wybierz status zawodowy" }),
  }),
  preferredDate: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  rodoConsent: z.literal(true, {
    errorMap: () => ({ message: "Bez zgody na przekazanie danych trenerce nie wolno utworzyć leada" }),
  }),
  // Odrębna podstawa (art. 398 PKE) — NIEobowiązkowa, więc zwykły boolean, nie literal(true).
  // Brak zgody = lead bez prawa do telefonu, nie błąd walidacji.
  contactConsent: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, "Hasło musi mieć min. 10 znaków").max(200),
});

/**
 * SAMODZIELNA REJESTRACJA AKADEMII (publiczny formularz `/dla-akademii/rejestracja`).
 *
 * Zbiera dokładnie tyle, ile potrzeba, żeby (a) założyć konto do panelu i (b) mieć o czym
 * rozmawiać przez telefon. Wszystko poza tym — bio, zdjęcia, certyfikaty — akademia uzupełnia
 * już zalogowana, bo wymaganie tego przy rejestracji zabiłoby konwersję formularza.
 *
 * 🔴 `burSegment` NIE jest kosmetyką: podmiot bez wpisu do Bazy Usług Rozwojowych nie sprzeda
 * szkolenia z dofinansowaniem, więc nie może dostać leada. Deklaracja z formularza jest tylko
 * DEKLARACJĄ — weryfikuje ją człowiek w karcie dostawcy PARP przed umową (skill `research-trenerek`).
 */
export const academyRegistrationSchema = z.object({
  name: z.string().trim().min(3, "Podaj nazwę akademii lub swoje imię i nazwisko").max(160),
  contactPerson: z.string().trim().min(3, "Podaj imię i nazwisko osoby do kontaktu").max(160),
  email: z.string().trim().email("Podaj poprawny adres e-mail").max(255),
  phone: z
    .string()
    .trim()
    .min(9, "Podaj numer telefonu — na niego zadzwonimy")
    .max(20)
    .regex(/^[+\d\s-]+$/, "Podaj poprawny numer telefonu"),
  city: z.string().trim().min(2, "Podaj miasto").max(100),
  voivodeship: z.enum(voivodeshipSlugs, { errorMap: () => ({ message: "Wybierz województwo" }) }),
  categories: z
    .array(z.enum(CATEGORIES as unknown as [string, ...string[]]))
    .min(1, "Zaznacz przynajmniej jedną kategorię szkoleń"),
  nip: z
    .string()
    .trim()
    .max(20)
    .regex(/^[\d\s-]*$/, "NIP to same cyfry")
    .optional()
    .or(z.literal("")),
  burSegment: z.enum(["A", "B", "nieznany"], { errorMap: () => ({ message: "Zaznacz, czy masz wpis do BUR" }) }),
  burProviderId: z.string().trim().max(20).optional().or(z.literal("")),
  academyWebsite: z.string().trim().max(300).optional().or(z.literal("")),
  instagram: z.string().trim().max(300).optional().or(z.literal("")),
  password: z.string().min(10, "Hasło musi mieć min. 10 znaków").max(200),
  // Akceptacja regulaminu i polityki prywatności — wymagana, bo bez niej nie ma podstawy
  // do założenia konta. `literal(true)` (nie boolean), żeby odznaczony checkbox był błędem.
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "Bez akceptacji regulaminu i polityki prywatności nie założymy konta" }),
  }),
  // Prośba o kontakt handlowy — też wymagana, bo cały sens rejestracji to rozmowa o współpracy.
  // Osobny checkbox, nie doklejony do regulaminu: art. 398 Prawa komunikacji elektronicznej
  // wymaga zgody na kontakt telefoniczny/e-mail wyrażonej odrębnie.
  contactConsent: z.literal(true, {
    errorMap: () => ({ message: "Potrzebujemy zgody na kontakt — inaczej nie mamy jak się odezwać" }),
  }),
  // honeypot — patrz `/api/lead`: bot wypełnia, człowiek nie widzi
  fax: z.string().max(200).optional().or(z.literal("")),
});

export const trainerSchema = z.object({
  name: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/, "Slug: małe litery, cyfry, myślniki"),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  bio: z.string().max(8000).optional().or(z.literal("")),
  specializations: z.array(z.enum(CATEGORIES as unknown as [string, ...string[]])).min(1),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  voivodeship: z.enum(voivodeshipSlugs).optional().or(z.literal("")),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal("")),
  coverUrl: z.string().trim().max(500).optional().or(z.literal("")),
  certificates: z.array(z.object({ title: z.string().max(200), description: z.string().max(500).optional() })).default([]),
  instagram: z.string().trim().max(300).optional().or(z.literal("")),
  facebook: z.string().trim().max(300).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  studentsCount: z.coerce.number().int().min(0).default(0),
  billingModel: z.enum(["per_lead", "per_zapis"]).default("per_zapis"),
  rate: z.coerce.number().int().min(0).default(500),
  leadLimitMonthly: z.coerce.number().int().min(0).default(50),
  autoAssign: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

export const courseSchema = z.object({
  title: z.string().trim().min(3).max(220),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9-]+$/),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]]),
  level: z.enum(LEVELS as unknown as [string, ...string[]]),
  mode: z.enum(MODES as unknown as [string, ...string[]]),
  shortDescription: z.string().max(500).optional().or(z.literal("")),
  description: z.string().max(20000).optional().or(z.literal("")),
  program: z.array(z.string().max(300)).default([]),
  includes: z.array(z.string().max(300)).default([]),
  forWhom: z.string().max(4000).optional().or(z.literal("")),
  price: z.coerce.number().int().min(0),
  subsidyPercent: z.coerce.number().int().min(0).max(100).default(100),
  nextDate: z.string().trim().max(40).optional().or(z.literal("")),
  totalSpots: z.coerce.number().int().min(1).default(8),
  takenSpots: z.coerce.number().int().min(0).default(0),
  durationHours: z.coerce.number().int().min(1).default(16),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  voivodeship: z.enum(voivodeshipSlugs).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  trainerId: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["szkic", "opublikowane"]).default("szkic"),
});

export const blogPostSchema = z.object({
  title: z.string().trim().min(3).max(220),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9-]+$/),
  category: z.enum(BLOG_CATEGORIES as unknown as [string, ...string[]]),
  excerpt: z.string().trim().min(10).max(600),
  content: z.string().min(10).max(100000),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  metaTitle: z.string().trim().max(200).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(300).optional().or(z.literal("")),
  author: z.string().trim().max(120).default("Redakcja Uniwersytet Beauty"),
  readingMinutes: z.coerce.number().int().min(1).max(60).default(5),
  status: z.enum(["szkic", "opublikowane"]).default("szkic"),
});

export const settingsSchema = z.object({
  multiSellLimit: z.coerce.number().int().min(1).max(3),
  defaultRatePerLead: z.coerce.number().int().min(0),
  defaultRatePerSignup: z.coerce.number().int().min(0),
  notifyEmail: z.string().trim().email().max(255),
  leadEmailSubject: z.string().trim().min(3).max(300),
  leadEmailTemplate: z.string().trim().min(10).max(10000),
  // Maile do kursantki: potwierdzenie zgłoszenia i potwierdzenie zapisu.
  confirmEmailSubject: z.string().trim().min(3).max(300),
  confirmEmailTemplate: z.string().trim().min(10).max(10000),
  signupEmailSubject: z.string().trim().min(3).max(300),
  signupEmailTemplate: z.string().trim().min(10).max(10000),
});

// ===== CRM TRENEREK =====

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Liczba całkowita albo puste pole z formularza (`""` / null) → null w bazie. */
const optionalInt = z
  .union([z.coerce.number().int().min(0), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined || v === null ? null : v));

export const prospectSchema = z.object({
  name: z.string().trim().min(2, "Podaj nazwę podmiotu").max(200),
  legalName: optionalText(250),
  nip: optionalText(20),
  krs: optionalText(20),
  city: optionalText(100),
  voivodeship: z.enum(voivodeshipSlugs).optional().or(z.literal("")),
  categories: z.array(z.enum(CATEGORIES as unknown as [string, ...string[]])).default([]),
  phone: optionalText(40),
  email: z.string().trim().email("Podaj poprawny adres email").max(255).optional().or(z.literal("")),
  website: optionalText(300),
  instagram: optionalText(300),
  facebook: optionalText(300),

  status: z.enum(PROSPECT_STATUSES as unknown as [string, ...string[]]).default("potencjalny"),
  priority: z.enum(PROSPECT_PRIORITIES as unknown as [string, ...string[]]).default("sredni"),
  source: z.enum(PROSPECT_SOURCES as unknown as [string, ...string[]]).default("reczny"),

  burSegment: z.enum(BUR_SEGMENTS as unknown as [string, ...string[]]).default("nieznany"),
  burProviderId: optionalText(20),
  burUrl: optionalText(500),
  burServicesCompleted: optionalInt,
  burServicesActive: optionalInt,
  burRatingX10: optionalInt,
  burReviewCount: optionalInt,

  dossierPath: optionalText(500),
  researchNotes: z.string().max(20000).optional().or(z.literal("")),

  // --- follow-up: kiedy trzeba oddzwonić (21.09.2026) ---
  /** `RRRR-MM-DD` z inputu `type="date"`; string pusty = wyczyść termin. Serwer dokleja 9:00 czasu Warszawy. */
  nextActionAt: z.union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę w formacie RRRR-MM-DD"),
  ]).optional(),
  nextActionNote: optionalText(200),
});

/** Edycja: te same reguły, ale każde pole opcjonalne (PATCH częściowy). */
export const prospectPatchSchema = prospectSchema.partial();

export const prospectActivitySchema = z.object({
  type: z.enum(PROSPECT_ACTIVITY_TYPES as unknown as [string, ...string[]]).default("notatka"),
  content: z.string().trim().min(1, "Treść nie może być pusta").max(4000),
});

/**
 * Szybkie akcje z bloku „☎️ Do zadzwonienia" — ZAMKNIĘTA lista działań, nie dowolny PATCH pól bazy.
 * `days` dotyczy wyłącznie „dzwonilem" (jutro / +3 dni / +7 dni z UI).
 * Musi być sprawdzona PRZED `prospectPatchSchema`: ten drugi jest `.partial()`, więc payload
 * `{quickAction, days}` przeszedłby go po cichu jako pusty obiekt (żadne pole nie pasuje) —
 * PATCH zwróciłby 200 bez zmiany, a UI odczytałby to jako sukces.
 */
export const prospectQuickActionSchema = z.discriminatedUnion("quickAction", [
  z.object({ quickAction: z.literal("dzwonilem"), days: z.union([z.literal(1), z.literal(3), z.literal(7)]) }),
  z.object({ quickAction: z.literal("nie_odbiera") }),
  z.object({ quickAction: z.literal("odloz") }),
]);

export const researchJobPatchSchema = z.object({
  status: z.enum(RESEARCH_JOB_STATUSES as unknown as [string, ...string[]]),
  resultNotes: z.string().max(4000).optional().or(z.literal("")),
});

export const leadStatusUpdateSchema = z.object({
  status: z.enum(["nowy", "przydzielony", "skontaktowany", "zapisana", "rozliczony", "odrzucony"]),
  rejectionReason: z.string().max(1000).optional().or(z.literal("")),
});
