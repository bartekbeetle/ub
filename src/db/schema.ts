import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ===== ENUMS =====

export const userRoleEnum = pgEnum("user_role", ["admin", "trenerka"]);

export const leadStatusEnum = pgEnum("lead_status", [
  "nowy",
  "przydzielony",
  "skontaktowany",
  "zapisana",
  "rozliczony",
  "odrzucony",
]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "przydzielony",
  "skontaktowany",
  "zapisana",
  "odrzucony",
]);

export const billingStatusEnum = pgEnum("billing_status", [
  "do_zafakturowania",
  "zafakturowane",
  "oplacone",
]);

export const billingModelEnum = pgEnum("billing_model", ["per_lead", "per_zapis"]);

export const contentStatusEnum = pgEnum("content_status", ["szkic", "opublikowane"]);

/**
 * Skąd przyszła kursantka. `quiz` i `recepcjonistka` są dołożone pod przyszłe wejścia
 * (formularz quizowy i agent głosowy) — bez nich każde nowe źródło wymagałoby migracji
 * w środku wdrożenia. Wartości enuma w Postgresie da się tylko DOKŁADAĆ, nigdy usuwać,
 * więc dokładamy je zawczasu i jednym ruchem.
 */
export const leadSourceEnum = pgEnum("lead_source", [
  "kurs",
  "landing",
  "konsultacja",
  "quiz",
  "recepcjonistka",
]);

export const submissionTypeEnum = pgEnum("submission_type", ["kontakt", "konsultacja"]);

export const emailStatusEnum = pgEnum("email_status", ["w_kolejce", "wyslany", "blad"]);

// --- CRM TRENEREK (pipeline B2B) ---

/**
 * Lejek pozyskania akademii/trenerki. Rozłączny z `trainers`:
 * `trainers` = katalog PUBLICZNY (każdy wiersz = profil pod /trenerka/<slug>),
 * `prospects` = robocza baza kontaktów, której nikt z zewnątrz nie widzi.
 * Awans prospekta do katalogu następuje dopiero przy statusie `umowa`.
 */
export const prospectStatusEnum = pgEnum("prospect_status", [
  "potencjalny",
  "research",
  "do_kontaktu",
  "kontakt",
  "rozmowa",
  "umowa",
  "aktywna",
  "odrzucony",
  "parking",
]);

export const prospectPriorityEnum = pgEnum("prospect_priority", ["wysoki", "sredni", "niski"]);

/**
 * Segment BUR decyduje, czy podmiot w ogóle może przyjąć leada z dofinansowaniem:
 * A = ma wpis do Bazy Usług Rozwojowych, B = nie ma (kandydat na model „prowizja za papier").
 */
export const burSegmentEnum = pgEnum("bur_segment", ["A", "B", "nieznany"]);

export const prospectActivityTypeEnum = pgEnum("prospect_activity_type", [
  "notatka",
  "telefon",
  "email",
  "spotkanie",
  "zmiana_statusu",
]);

export const researchJobStatusEnum = pgEnum("research_job_status", [
  "pending",
  "w_toku",
  "gotowe",
  "pominiete",
]);

/**
 * Ścieżka finansowania z BUR. To NIE jest kosmetyka — od tego zależy, czy kursantka
 * w ogóle może dostać pieniądze, i czy trenerka może ją obsłużyć.
 *
 * Regulamin naboru (subregion północny woj. śląskiego, §1 ust. 3) wyklucza z projektu
 * dla OSÓB DOROSŁYCH każdego, kto jest „przedsiębiorcą w rozumieniu art. 4 ust. 1-2
 * Prawa przedsiębiorców" — łącznie z JDG i wspólnikami spółki cywilnej, także
 * z działalnością ZAWIESZONĄ. Właścicielka salonu idzie więc zupełnie inną ścieżką
 * (PSF dla MŚP), do innego operatora i innego naboru.
 *
 * Konsekwencja: jedno pytanie („masz działalność gospodarczą?") rozgałęzia całą rozmowę
 * i cały matching. `employmentStatus` tego NIE rozstrzyga — „pracująca" nie mówi nic
 * o wpisie do CEIDG.
 */
export const projectTrackEnum = pgEnum("project_track", [
  "osoby_dorosle",
  "przedsiebiorcy",
  "nieznana",
]);

/**
 * Kanał, którym prowadzona jest rozmowa. Jeden mózg recepcjonistki obsługuje wszystkie —
 * kanał zmienia tylko sposób dostarczenia i limity (np. okno 24 h na Instagramie).
 */
export const conversationChannelEnum = pgEnum("conversation_channel", [
  "czat",
  "telefon",
  "sms",
  "email",
  "instagram",
  "facebook",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "aktywna",
  "zakonczona",
  "przekazana_czlowiekowi",
  "porzucona",
]);

/**
 * Kto powiedział daną wiadomość. `operator` = żywy człowiek, który przejął rozmowę —
 * trzymamy to osobno od `recepcjonistka`, bo przy sporze trzeba umieć wykazać,
 * co powiedziała maszyna, a co człowiek.
 */
export const messageRoleEnum = pgEnum("message_role", [
  "kursantka",
  "recepcjonistka",
  "operator",
  "system",
]);

// ===== UŻYTKOWNICY I SESJE =====

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("trenerka"),
  trainerId: integer("trainer_id").references(() => trainers.id),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // sha256(token)
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

// ===== TRENERKI =====

export const trainers = pgTable("trainers", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 40 }),
  bio: text("bio"),
  specializations: jsonb("specializations").$type<string[]>().notNull().default([]),
  city: varchar("city", { length: 100 }),
  voivodeship: varchar("voivodeship", { length: 40 }),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  certificates: jsonb("certificates").$type<{ title: string; description?: string }[]>().notNull().default([]),
  instagram: text("instagram"),
  facebook: text("facebook"),
  website: text("website"),
  rating: integer("rating_x10").notNull().default(0), // ocena × 10 (49 = 4.9)
  reviewCount: integer("review_count").notNull().default(0),
  studentsCount: integer("students_count").notNull().default(0),
  billingModel: billingModelEnum("billing_model").notNull().default("per_zapis"),
  rate: integer("rate_pln").notNull().default(500), // PLN
  leadLimitMonthly: integer("lead_limit_monthly").notNull().default(50),
  // Bramka umowy: dopóki false, trenerka NIE dostaje leadów automatem — tylko ręcznie z panelu.
  // Domyślnie false, bo lead = dane osobowe kursantki i bez umowy nie wolno ich przekazać.
  // Włączamy dopiero po podpisaniu umowy partnerskiej.
  autoAssign: boolean("auto_assign").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainer_id")
    .notNull()
    .references(() => trainers.id, { onDelete: "cascade" }),
  authorName: varchar("author_name", { length: 120 }).notNull(),
  rating: integer("rating").notNull(), // 1-5
  content: text("content").notNull(),
  courseTitle: varchar("course_title", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ===== SZKOLENIA =====

export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: varchar("title", { length: 220 }).notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    level: varchar("level", { length: 40 }).notNull().default("Podstawowy"),
    mode: varchar("mode", { length: 40 }).notNull().default("Stacjonarny"),
    shortDescription: text("short_description"),
    description: text("description"),
    program: jsonb("program").$type<string[]>().notNull().default([]),
    includes: jsonb("includes").$type<string[]>().notNull().default([]),
    forWhom: text("for_whom"),
    price: integer("price_pln").notNull(), // PLN
    subsidyPercent: integer("subsidy_percent").notNull().default(90),
    nextDate: varchar("next_date", { length: 40 }), // ISO date
    totalSpots: integer("total_spots").notNull().default(8),
    takenSpots: integer("taken_spots").notNull().default(0),
    durationHours: integer("duration_hours").notNull().default(16),
    city: varchar("city", { length: 100 }),
    voivodeship: varchar("voivodeship", { length: 40 }),
    imageUrl: text("image_url"),
    trainerId: integer("trainer_id").references(() => trainers.id),
    status: contentStatusEnum("status").notNull().default("szkic"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("courses_cat_idx").on(t.category), index("courses_voiv_idx").on(t.voivodeship)]
);

/**
 * SESJE QUIZU — kto zaczął wypełniać i gdzie się zatrzymał.
 *
 * Po co osobna tabela, a nie kolumny w `leads`: lead powstaje DOPIERO po zgodzie RODO
 * na ostatnim kroku. Tu zapisujemy ludzi, którzy tej zgody jeszcze NIE dali — więc nie wolno
 * ich trzymać razem z leadami, bo zatarłoby to granicę „mamy podstawę / nie mamy podstawy".
 *
 * 🔴 GRANICA PRAWNA, której nie wolno przekroczyć:
 * sam zapis porzuconych odpowiedzi jest dopuszczalny (prawnie uzasadniony interes — wiemy,
 * gdzie formularz się sypie). ALE **wysyłka marketingowa do osoby, która porzuciła quiz,
 * wymaga zaznaczonej zgody `marketingConsent`** (art. 398 Prawa komunikacji elektronicznej).
 * Dlatego checkbox zgody stoi już na kroku 1, obok maila — bez niego rekord nadaje się
 * wyłącznie do statystyki i do remarketingu przez piksel, NIE do maila.
 * Kolumna `marketingConsentAt` jest jedynym dopuszczalnym filtrem wysyłki.
 */
export const quizSessions = pgTable(
  "quiz_sessions",
  {
    id: serial("id").primaryKey(),
    /** Klucz z przeglądarki (sessionStorage) — pozwala aktualizować ten sam wiersz przy kolejnych krokach. */
    sessionKey: varchar("session_key", { length: 64 }).notNull().unique(),

    name: varchar("name", { length: 160 }),
    email: varchar("email", { length: 200 }),
    phone: varchar("phone", { length: 40 }),

    category: varchar("category", { length: 60 }),
    voivodeship: varchar("voivodeship", { length: 40 }),
    city: varchar("city", { length: 120 }),

    /** Komplet odpowiedzi tak, jak wyglądały przy ostatnim zapisie. */
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),

    /** Na którym kroku osoba jest teraz i jak daleko doszła najdalej. */
    stepReached: integer("step_reached").notNull().default(1),
    maxStepReached: integer("max_step_reached").notNull().default(1),

    /** Zgoda marketingowa z kroku 1 — JEDYNA podstawa do maila, gdy quiz nie został dokończony. */
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    consentVersion: varchar("consent_version", { length: 20 }),

    completed: boolean("completed").notNull().default(false),
    /** Ustawiane, gdy quiz dojdzie do końca i powstanie lead. */
    leadId: integer("lead_id").references(() => leads.id),

    utmSource: varchar("utm_source", { length: 120 }),
    utmMedium: varchar("utm_medium", { length: 120 }),
    utmCampaign: varchar("utm_campaign", { length: 160 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quiz_sessions_completed_idx").on(t.completed),
    index("quiz_sessions_email_idx").on(t.email),
    index("quiz_sessions_maxstep_idx").on(t.maxStepReached),
  ]
);

// ===== BLOG =====

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  title: varchar("title", { length: 220 }).notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(), // markdown
  imageUrl: text("image_url"),
  metaTitle: varchar("meta_title", { length: 200 }),
  metaDescription: varchar("meta_description", { length: 300 }),
  author: varchar("author", { length: 120 }).notNull().default("Redakcja Uniwersytet Beauty"),
  readingMinutes: integer("reading_minutes").notNull().default(5),
  status: contentStatusEnum("status").notNull().default("szkic"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ===== LEADY (serce biznesu) =====

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    voivodeship: varchar("voivodeship", { length: 40 }).notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    employmentStatus: varchar("employment_status", { length: 60 }).notNull(),
    preferredDate: varchar("preferred_date", { length: 120 }),
    message: text("message"),
    courseId: integer("course_id").references(() => courses.id),
    source: leadSourceEnum("source").notNull().default("landing"),
    utmSource: varchar("utm_source", { length: 120 }),
    utmMedium: varchar("utm_medium", { length: 120 }),
    utmCampaign: varchar("utm_campaign", { length: 160 }),
    status: leadStatusEnum("status").notNull().default("nowy"),
    rejectionReason: text("rejection_reason"),
    notes: text("notes"),
    // === ZGODY — każda osobno, bo to trzy różne cele i trzy różne podstawy ===
    // 1. Przetwarzanie danych i przekazanie ich maks. 3 trenerkom (art. 6 ust. 1 lit. a RODO). Wymagana.
    rodoConsentAt: timestamp("rodo_consent_at", { withTimezone: true }).notNull(),
    // 2. Kontakt telefoniczny/SMS w celu przedstawienia oferty (art. 398 Prawa komunikacji
    //    elektronicznej — telefon marketingowy wymaga ODRĘBNEJ, uprzedniej zgody). Wymagana:
    //    bez niej trenerka nie ma jak zadzwonić, a cały model opiera się na telefonie.
    //    NULL w starych rekordach = zgoda nie została odebrana (formularz jej nie zbierał).
    contactConsentAt: timestamp("contact_consent_at", { withTimezone: true }),
    // 3. Marketing własny UB e-mailem (newsletter, oferty). Opcjonalna — brak nie blokuje zgłoszenia.
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    /** Wersja klauzul zgód pokazanych przy tym zgłoszeniu — dowód, NA CO konkretnie się zgodziła. */
    consentVersion: varchar("consent_version", { length: 20 }),

    // === KWALIFIKACJA Z ROZMOWY (recepcjonistka) ===
    // Pola wolnotekstowe nie wystarczą: to jest zestaw, po którym dobieramy leady pod
    // świeżo podpisaną trenerkę. Notatka tekstowa nie da się posortować ani odfiltrować.
    /**
     * Czy ma działalność gospodarczą (CEIDG / wspólnik s.c., także zawieszoną).
     * NULL = jeszcze nie zapytaliśmy. To pytanie rozstrzyga ścieżkę finansowania,
     * więc pada w pierwszej minucie rozmowy.
     */
    hasBusinessActivity: boolean("has_business_activity"),
    /** Ścieżka wynikająca z powyższego + z tego, jakie nabory są w jej regionie. */
    projectTrack: projectTrackEnum("project_track").notNull().default("nieznana"),
    /**
     * Miasto — województwo NIE wystarcza. Operatorzy działają na subregionach, a warunek
     * uczestnictwa to stałe zamieszkanie lub praca na obszarze projektu (min. 3 miesiące).
     */
    city: varchar("city", { length: 120 }),
    /** Czy usłyszała o wkładzie własnym i wprost powiedziała, że da radę. */
    ownContributionOk: boolean("own_contribution_ok"),
    /** Kiedy realnie chce zacząć — do zestawienia z oknem naboru. */
    startWindow: varchar("start_window", { length: 120 }),
    /** Ile km gotowa dojechać na szkolenie. Próg miękki przy matchingu, nie twardy filtr. */
    travelKm: integer("travel_km"),

    // === ŚCIEŻKA WNIOSKU O DOFINANSOWANIE ===
    // Sześć checkpointów, bo TO jest łańcuch, który realnie mierzy przychód: UB dostaje
    // 500 zł za ZAPISANĄ kursantkę, a zapis wisi na przejściu tej procedury (3-8 tygodni).
    // Osobne znaczniki czasu zamiast jednego pola „etap", żeby dało się liczyć, ile czasu
    // lead spędza na każdym progu i gdzie naprawdę umiera.
    burOperatorName: varchar("bur_operator_name", { length: 200 }),
    /** Numer projektu z listy PARP, np. FESL.06.06-... — żeby dało się wrócić do regulaminu. */
    burProjectNumber: varchar("bur_project_number", { length: 60 }),
    /** Koniec naboru u TEGO operatora. Uczciwy termin = jedyna presja, jakiej używamy. */
    burDeadlineAt: timestamp("bur_deadline_at", { withTimezone: true }),
    burAccountAt: timestamp("bur_account_at", { withTimezone: true }),
    burOperatorIdentifiedAt: timestamp("bur_operator_identified_at", { withTimezone: true }),
    burApplicationSentAt: timestamp("bur_application_sent_at", { withTimezone: true }),
    burDecisionAt: timestamp("bur_decision_at", { withTimezone: true }),
    burContractAt: timestamp("bur_contract_at", { withTimezone: true }),
    burEnrolledAt: timestamp("bur_enrolled_at", { withTimezone: true }),
    /**
     * Potwierdzenie zapisu OD KURSANTKI, nie od trenerki. Dziś jedynym źródłem prawdy
     * do faktury 500 zł jest deklaracja trenerki — to jest nasz niezależny audyt przychodu
     * i zabezpieczenie przed obchodzeniem platformy.
     */
    enrollmentConfirmedByLead: boolean("enrollment_confirmed_by_lead").notNull().default(false),

    // === TEMPERATURA ===
    /** Kiedy MY odezwaliśmy się ostatnio. */
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    /**
     * Kiedy ONA odpowiedziała ostatnio. Temperaturę leada liczymy od TEGO pola, nie od
     * wypełnienia formularza ani nie od naszej wysyłki — inaczej „ciepły" byłby lead,
     * do którego tylko my piszemy w próżnię.
     */
    lastReplyAt: timestamp("last_reply_at", { withTimezone: true }),
    /** Umówiony następny kontakt. Rozmowa bez ustalonej daty kolejnej to rozmowa stracona. */
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),

    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leads_status_idx").on(t.status),
    index("leads_created_idx").on(t.createdAt),
    // Matching pod świeżo podpisaną trenerkę filtruje po ścieżce + województwie + kategorii
    // i sortuje po temperaturze. Bez tych indeksów to jest skan całej tabeli przy każdym doborze.
    index("leads_track_idx").on(t.projectTrack),
    index("leads_reply_idx").on(t.lastReplyAt),
  ]
);

export const leadAssignments = pgTable(
  "lead_assignments",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    trainerId: integer("trainer_id")
      .notNull()
      .references(() => trainers.id, { onDelete: "cascade" }),
    status: assignmentStatusEnum("status").notNull().default("przydzielony"),
    rejectionReason: text("rejection_reason"),
    billingStatus: billingStatusEnum("billing_status").notNull().default("do_zafakturowania"),
    amount: integer("amount_pln").notNull().default(0), // naliczona kwota PLN
    assignedBy: varchar("assigned_by", { length: 60 }).notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assign_lead_idx").on(t.leadId), index("assign_trainer_idx").on(t.trainerId)]
);

// ===== CRM TRENEREK — PIPELINE B2B =====

/**
 * Pozyskiwanie akademii i trenerek jako klientów B2B (płacą 500 zł za zapisaną kursantkę).
 *
 * CELOWO osobna tabela od `trainers`, a nie kilka dodatkowych kolumn tam:
 * każdy wiersz w `trainers` ma `slug` i renderuje publiczny profil w katalogu.
 * Wrzucenie tam kilkudziesięciu niezweryfikowanych podmiotów zaśmieciłoby serwis
 * pustymi profilami i rozjechało SEO (cienkie strony w indeksie).
 * Profil publiczny powstaje dopiero PO podpisaniu umowy — przyciskiem „Utwórz profil trenerki".
 */
export const prospects = pgTable(
  "prospects",
  {
    id: serial("id").primaryKey(),

    // --- podmiot ---
    name: varchar("name", { length: 200 }).notNull(), // nazwa handlowa / marka
    legalName: varchar("legal_name", { length: 250 }), // nazwa z rejestru
    nip: varchar("nip", { length: 20 }),
    krs: varchar("krs", { length: 20 }),
    city: varchar("city", { length: 100 }),
    voivodeship: varchar("voivodeship", { length: 40 }),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 255 }),
    website: text("website"),
    instagram: text("instagram"),
    facebook: text("facebook"),

    // --- pipeline ---
    status: prospectStatusEnum("status").notNull().default("potencjalny"),
    priority: prospectPriorityEnum("priority").notNull().default("sredni"),
    source: varchar("source", { length: 60 }).notNull().default("reczny"), // research-lead | reczny | polecenie

    // --- BUR (najważniejsza kwalifikacja biznesowa) ---
    burSegment: burSegmentEnum("bur_segment").notNull().default("nieznany"),
    burProviderId: varchar("bur_provider_id", { length: 20 }), // ID karty dostawcy w PARP
    burUrl: text("bur_url"),
    burServicesCompleted: integer("bur_services_completed"),
    burServicesActive: integer("bur_services_active"),
    burRatingX10: integer("bur_rating_x10"), // ocena × 10 (50 = 5,0) — jak trainers.rating
    burReviewCount: integer("bur_review_count"),
    burCheckedAt: timestamp("bur_checked_at", { withTimezone: true }),
    /**
     * Pod jakie ścieżki finansowania nadają się jej szkolenia. Sam wpis do BUR (segment A)
     * NIE wystarcza do matchingu: nabory dla osób dorosłych i nabory dla przedsiębiorców
     * to osobne projekty, osobni operatorzy i osobne kryteria uczestnika. Trenerka obsługująca
     * kursantkę bez firmy w Śląskiem nie obsłuży właścicielki salonu w Małopolsce.
     *
     * Lista, nie pojedyncza wartość — jedna akademia może mieć usługi w obu ścieżkach.
     * Pusta = nie ustalono; wtedy nie wysyłamy jej leadów automatem.
     */
    projectTracks: jsonb("project_tracks").$type<string[]>().notNull().default([]),
    /** Zasięg terytorialny: usługa musi odbyć się na obszarze operatora kursantki. */
    servesVoivodeships: jsonb("serves_voivodeships").$type<string[]>().notNull().default([]),

    // --- research ---
    dossierPath: text("dossier_path"), // ścieżka do pliku .md w vaulcie
    researchNotes: text("research_notes"),
    researchedAt: timestamp("researched_at", { withTimezone: true }),

    // --- powiązania ---
    trainerId: integer("trainer_id").references(() => trainers.id, { onDelete: "set null" }),
    triggeredByLeadId: integer("triggered_by_lead_id").references(() => leads.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prospects_status_idx").on(t.status),
    index("prospects_voiv_idx").on(t.voivodeship),
    index("prospects_bur_idx").on(t.burSegment),
  ]
);

/** Oś czasu kontaktu z prospektem — notatki, telefony, maile i automatyczne wpisy o zmianie statusu. */
export const prospectActivities = pgTable(
  "prospect_activities",
  {
    id: serial("id").primaryKey(),
    prospectId: integer("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    type: prospectActivityTypeEnum("type").notNull().default("notatka"),
    content: text("content").notNull(),
    createdBy: varchar("created_by", { length: 60 }).notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("prospect_activities_prospect_idx").on(t.prospectId)]
);

/**
 * Kolejka researchu: nowy lead = sygnał „poszukaj akademii w tym województwie i kategorii".
 * To jest TYLKO rejestr zadania do zrobienia — nic tego nie miele samo z siebie.
 * Kolejkę przerabia człowiek albo agent w sesji (skill `research-trenerek`).
 */
export const researchJobs = pgTable(
  "research_jobs",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    voivodeship: varchar("voivodeship", { length: 40 }).notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    status: researchJobStatusEnum("status").notNull().default("pending"),
    resultNotes: text("result_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("research_jobs_status_idx").on(t.status)]
);

// ===== RECEPCJONISTKA — ROZMOWY =====

/**
 * Rozmowa prowadzona przez recepcjonistkę AI. Jeden mózg, wiele kanałów — dlatego
 * rozmowa jest bytem osobnym od kanału i od leada.
 *
 * `leadId` jest NULLOWALNE i to jest celowe: czat na stronie zaczyna się anonimowo,
 * a lead powstaje dopiero w trakcie, gdy kursantka poda dane i zgody. Gdyby rozmowa
 * wymagała leada z góry, musielibyśmy zakładać pusty rekord osobowy przy każdym
 * otwarciu okienka czatu — czyli zbierać dane bez podstawy.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    channel: conversationChannelEnum("channel").notNull(),
    status: conversationStatusEnum("status").notNull().default("aktywna"),
    /**
     * Token do prywatnej ścieżki kursantki (`/moja-sciezka/[token]`). Link wysyłamy
     * mailem/SMS-em zaraz po zgłoszeniu, więc musi być nieodgadywalny — nie ID rekordu.
     */
    publicToken: varchar("public_token", { length: 64 }),
    /** Identyfikator po stronie kanału: CallSid z Twilio, wątek IG, Message-ID maila. */
    externalRef: varchar("external_ref", { length: 200 }),
    /**
     * Kiedy recepcjonistka poinformowała, że jest AI. Art. 50 EU AI Act obowiązuje
     * od 02.08.2026: osoba ma być o tym poinformowana jasno i NAJPÓŹNIEJ przy pierwszej
     * interakcji. Zapisujemy znacznik, bo obowiązek trzeba umieć wykazać, a nie deklarować.
     */
    aiDisclosedAt: timestamp("ai_disclosed_at", { withTimezone: true }),
    /**
     * Zgoda, na podstawie której wykonano kontakt — kopiowana z leada W MOMENCIE rozmowy.
     * Snapshot, nie join: gdyby kursantka później wycofała zgodę, musimy nadal umieć wykazać,
     * że w chwili telefonu zgoda była. Dla czatu (kontakt inicjowany przez nią) puste.
     */
    contactConsentAt: timestamp("contact_consent_at", { withTimezone: true }),
    /** Podsumowanie rozmowy — to leci mailem do kursantki i ląduje na karcie w panelu. */
    summary: text("summary"),
    /** Powód przekazania człowiekowi, jeśli do niego doszło. */
    handoverReason: text("handover_reason"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    index("conv_lead_idx").on(t.leadId),
    index("conv_status_idx").on(t.status),
    uniqueIndex("conv_token_idx").on(t.publicToken),
  ]
);

/**
 * Pojedyncza wypowiedź. Trzymamy pełny zapis, bo (a) trenerka dostaje transkrypt zamiast
 * zgadywać, (b) przy sporze trzeba wykazać, co dokładnie maszyna obiecała kursantce.
 */
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    /**
     * Surowe dane kanału: nagranie i czas trwania dla telefonu, załączniki dla maila,
     * a dla odpowiedzi modelu — użyte źródła z bazy BUR (numer projektu, operator).
     * Bez tego nie da się później sprawdzić, SKĄD recepcjonistka wzięła podaną liczbę.
     */
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("msg_conv_idx").on(t.conversationId, t.createdAt)]
);

// ===== AUDIT LOG =====

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actor: varchar("actor", { length: 120 }).notNull(), // "system" | "user:<id> <email>"
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: integer("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId)]
);

// ===== ZGŁOSZENIA (kontakt / konsultacja) =====

/**
 * Wiadomość z formularza kontaktowego. CELOWO osobna tabela od `leads`, mimo że
 * w panelu obie pokazujemy w jednym oknie („Kursantki").
 *
 * Powód jest prawny, nie estetyczny: zgłoszenie zbiera zgodę na kontakt Z NAMI,
 * a `leads.rodoConsentAt` to zgoda na przekazanie danych PODMIOTOWI ZEWNĘTRZNEMU
 * (trenerce). To dwie różne podstawy przetwarzania. Wspólna tabela zacierałaby tę
 * granicę i otwierała drogę do przydzielenia trenerce kontaktu, który nigdy na to
 * nie wyraził zgody.
 *
 * Most między światami: „Uzupełnij do leada" w panelu — admin dopytuje o województwo,
 * kategorię i status zawodowy, odbiera OSOBNĄ zgodę na przekazanie danych i dopiero
 * wtedy powstaje wiersz w `leads`. Zgłoszenie zostaje (ślad), wskazując na leada
 * przez `convertedToLeadId`.
 */
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  type: submissionTypeEnum("type").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  message: text("message"),
  isHandled: boolean("is_handled").notNull().default(false),
  /** Lead powstały z tego zgłoszenia. NULL = zgłoszenie nigdy nie dostało kwalifikacji. */
  convertedToLeadId: integer("converted_to_lead_id").references(() => leads.id, {
    onDelete: "set null",
  }),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ===== USTAWIENIA (singleton, id=1) =====

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  multiSellLimit: integer("multi_sell_limit").notNull().default(2), // max trenerek per lead
  defaultRatePerLead: integer("default_rate_per_lead").notNull().default(100),
  defaultRatePerSignup: integer("default_rate_per_signup").notNull().default(500),
  notifyEmail: varchar("notify_email", { length: 255 }).notNull().default("biuro@uniwersytetbeauty.pl"),
  leadEmailSubject: text("lead_email_subject")
    .notNull()
    .default("Nowy lead z Uniwersytet Beauty — {{kategoria}}, {{wojewodztwo}}"),
  leadEmailTemplate: text("lead_email_template").notNull().default(
    "Dzień dobry {{trenerka}},\n\nmamy dla Ciebie nową kandydatkę na szkolenie:\n\nImię i nazwisko: {{imie}}\nTelefon: {{telefon}}\nEmail: {{email}}\nKategoria: {{kategoria}}\nWojewództwo: {{wojewodztwo}}\nStatus zawodowy: {{status_zawodowy}}\n\nProsimy o kontakt z kandydatką w ciągu 24h.\n\nPozdrawiamy,\nZespół Uniwersytet Beauty"
  ),

  /**
   * Potwierdzenie dla KURSANTKI zaraz po zgłoszeniu. Do 18.09.2026 nie istniało:
   * kobieta zostawiała telefon, zgadzała się na kontakt i nie dostawała nic — cisza
   * aż do telefonu z akademii (albo w ogóle, gdy akademii w jej regionie nie mieliśmy).
   *
   * ⚠️ Guardrail ceny (voice.md): NIGDY „kurs za 0 zł". Dofinansowanie zawsze z warunkiem
   * („do 90%, zależnie od województwa i naboru"), bo nabory i progi realnie się różnią.
   * To jest mail TRANSAKCYJNY (obsługa zgłoszenia), nie marketingowy — nie wymaga zgody
   * marketingowej i nie wolno mu sprzedawać niczego dodatkowego.
   */
  confirmEmailSubject: text("confirm_email_subject")
    .notNull()
    .default("Mamy Twoje zgłoszenie — {{kategoria}}"),
  confirmEmailTemplate: text("confirm_email_template").notNull().default(
    "Dzień dobry {{imie}},\n\npotwierdzamy, że otrzymaliśmy Twoje zgłoszenie na szkolenie z zakresu: {{kategoria}} ({{wojewodztwo}}).\n\nCo dzieje się dalej:\n\n1. Dobieramy akademię w Twoim regionie, która prowadzi ten kurs i ma wpis do Bazy Usług Rozwojowych.\n2. Osoba z akademii kontaktuje się z Tobą telefonicznie — zwykle w ciągu 1-2 dni roboczych.\n3. Podczas rozmowy ustalacie termin, zakres szkolenia i to, jakie dofinansowanie możesz uzyskać.\n\nO dofinansowaniu: wsparcie z Bazy Usług Rozwojowych sięga 90% ceny szkolenia, a jego wysokość zależy od województwa, aktualnego naboru i Twojej sytuacji zawodowej. Dokładną kwotę poznasz po weryfikacji — akademia przeprowadzi Cię przez formalności.\n\nJeśli zgłoszenie było pomyłką albo chcesz wycofać zgodę na kontakt, po prostu odpisz na tę wiadomość.\n\nPozdrawiamy,\nZespół Uniwersytet Beauty\nbiuro@uniwersytetbeauty.pl · uniwersytetbeauty.pl"
  ),

  /**
   * Mail do KURSANTKI w chwili, gdy akademia oznaczy ją jako zapisaną. Domyka pętlę
   * i mówi wprost, że od tego momentu organizacja jest po stronie akademii — bez tego
   * kursantka wraca z pytaniami o termin do nas, a my ich nie znamy.
   * Zawiera też prośbę o sygnał, gdyby szkolenie nie doszło do skutku: to jedyny moment,
   * w którym dowiemy się o problemie, zanim wystawimy trenerce fakturę.
   */
  signupEmailSubject: text("signup_email_subject")
    .notNull()
    .default("Potwierdzenie zapisu na szkolenie — {{kategoria}}"),
  signupEmailTemplate: text("signup_email_template").notNull().default(
    "Dzień dobry {{imie}},\n\nakademia {{trenerka}} potwierdziła Twój zapis na szkolenie z zakresu: {{kategoria}}.\n\nOd tej chwili wszystkie sprawy organizacyjne — termin, miejsce, materiały i formalności dofinansowania — ustalasz bezpośrednio z akademią. To ona prowadzi szkolenie i wystawia dokumenty.\n\nGdyby coś poszło nie tak albo szkolenie nie doszło do skutku, daj nam znać na biuro@uniwersytetbeauty.pl. Chcemy o tym wiedzieć.\n\nPowodzenia na kursie,\nZespół Uniwersytet Beauty"
  ),
});

// ===== KOLEJKA EMAIL =====

export const emailQueue = pgTable(
  "email_queue",
  {
    id: serial("id").primaryKey(),
    toEmail: varchar("to_email", { length: 255 }).notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: emailStatusEnum("status").notNull().default("w_kolejce"),
    error: text("error"),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    /**
     * Rodzaj maila — patrz EMAIL_KIND w `@/lib/email`. Służy do DWÓCH rzeczy:
     * (a) idempotencji: status „zapisana" da się ustawić z trzech różnych miejsc w panelu
     *     (trenerka, admin-przydział, admin-lead) i bez tego pola każde kliknięcie wysyłałoby
     *     kursantce kolejnego maila z gratulacjami;
     * (b) diagnostyki: w kolejce widać, czego dokładnie nie udało się wysłać.
     */
    kind: varchar("kind", { length: 40 }).notNull().default("inne"),
    /**
     * Ile razy worker próbował wysłać. Bez licznika jeden trwale błędny adres
     * blokowałby kolejkę w nieskończonej pętli ponawiania.
     */
    attempts: integer("attempts").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_queue_status_idx").on(t.status),
    index("email_queue_lead_kind_idx").on(t.leadId, t.kind),
  ]
);

// ===== RELACJE =====

export const trainersRelations = relations(trainers, ({ many }) => ({
  courses: many(courses),
  reviews: many(reviews),
  assignments: many(leadAssignments),
}));

export const coursesRelations = relations(courses, ({ one }) => ({
  trainer: one(trainers, { fields: [courses.trainerId], references: [trainers.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  trainer: one(trainers, { fields: [reviews.trainerId], references: [trainers.id] }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  course: one(courses, { fields: [leads.courseId], references: [courses.id] }),
  assignments: many(leadAssignments),
  conversations: many(conversations),
}));

export const leadAssignmentsRelations = relations(leadAssignments, ({ one }) => ({
  lead: one(leads, { fields: [leadAssignments.leadId], references: [leads.id] }),
  trainer: one(trainers, { fields: [leadAssignments.trainerId], references: [trainers.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  trainer: one(trainers, { fields: [users.trainerId], references: [trainers.id] }),
}));

export const prospectsRelations = relations(prospects, ({ one, many }) => ({
  trainer: one(trainers, { fields: [prospects.trainerId], references: [trainers.id] }),
  triggeredByLead: one(leads, { fields: [prospects.triggeredByLeadId], references: [leads.id] }),
  activities: many(prospectActivities),
}));

export const prospectActivitiesRelations = relations(prospectActivities, ({ one }) => ({
  prospect: one(prospects, { fields: [prospectActivities.prospectId], references: [prospects.id] }),
}));

export const researchJobsRelations = relations(researchJobs, ({ one }) => ({
  lead: one(leads, { fields: [researchJobs.leadId], references: [leads.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  lead: one(leads, { fields: [conversations.leadId], references: [leads.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// ===== TYPY =====

export type User = typeof users.$inferSelect;
export type Trainer = typeof trainers.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type LeadAssignment = typeof leadAssignments.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Prospect = typeof prospects.$inferSelect;
export type ProspectActivity = typeof prospectActivities.$inferSelect;
export type ResearchJob = typeof researchJobs.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
