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

export const leadSourceEnum = pgEnum("lead_source", ["kurs", "landing", "konsultacja"]);

export const submissionTypeEnum = pgEnum("submission_type", ["kontakt", "konsultacja"]);

export const emailStatusEnum = pgEnum("email_status", ["w_kolejce", "wyslany", "blad"]);

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
    rodoConsentAt: timestamp("rodo_consent_at", { withTimezone: true }).notNull(),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("leads_status_idx").on(t.status), index("leads_created_idx").on(t.createdAt)]
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

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  type: submissionTypeEnum("type").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  message: text("message"),
  isHandled: boolean("is_handled").notNull().default(false),
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
});

// ===== KOLEJKA EMAIL =====

export const emailQueue = pgTable("email_queue", {
  id: serial("id").primaryKey(),
  toEmail: varchar("to_email", { length: 255 }).notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: emailStatusEnum("status").notNull().default("w_kolejce"),
  error: text("error"),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
}));

export const leadAssignmentsRelations = relations(leadAssignments, ({ one }) => ({
  lead: one(leads, { fields: [leadAssignments.leadId], references: [leads.id] }),
  trainer: one(trainers, { fields: [leadAssignments.trainerId], references: [trainers.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  trainer: one(trainers, { fields: [users.trainerId], references: [trainers.id] }),
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
