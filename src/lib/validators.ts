import { z } from "zod";
import { CATEGORIES, EMPLOYMENT_STATUSES, VOIVODESHIPS, LEVELS, MODES, BLOG_CATEGORIES } from "./constants";

const voivodeshipSlugs = VOIVODESHIPS.map((v) => v.slug) as [string, ...string[]];

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
  rodoConsent: z.literal(true, { errorMap: () => ({ message: "Zgoda RODO jest wymagana" }) }),
  courseId: z.number().int().positive().optional().nullable(),
  source: z.enum(["kurs", "landing", "konsultacja"]).default("landing"),
  utmSource: z.string().max(120).optional().or(z.literal("")),
  utmMedium: z.string().max(120).optional().or(z.literal("")),
  utmCampaign: z.string().max(160).optional().or(z.literal("")),
  // honeypot — musi być puste
  website: z.string().max(0, "Spam").optional().or(z.literal("")),
});

export const submissionSchema = z.object({
  type: z.enum(["kontakt", "konsultacja"]),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  website: z.string().max(0).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, "Hasło musi mieć min. 10 znaków").max(200),
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
  billingModel: z.enum(["per_lead", "per_zapis"]).default("per_lead"),
  rate: z.coerce.number().int().min(0).default(100),
  leadLimitMonthly: z.coerce.number().int().min(0).default(50),
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
});

export const leadStatusUpdateSchema = z.object({
  status: z.enum(["nowy", "przydzielony", "skontaktowany", "zapisana", "rozliczony", "odrzucony"]),
  rejectionReason: z.string().max(1000).optional().or(z.literal("")),
});
