import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AnyDb } from "@/lib/admin-audit-core";
import type { User } from "@/db/schema";
import { normalizePlPhone, smsLength, SMS_MAX_SEGMENTS } from "@/lib/sms/phone";
import { logAdminAction } from "@/lib/audit";
import { getTelefonSmsProvider } from "./smsgate";
import { normalizeAnyPhone } from "./phone";

export type Fail = { ok: false; status: number; error: string };

/** Wysyłka SMS-a przez telefon UB do dowolnego polskiego numeru komórkowego. */
export async function sendAdminSms(user: User, rawPhone: string, text: string): Promise<Fail | { ok: true; id: number; dryRun: boolean }> {
  const phone = normalizePlPhone(rawPhone);
  if (!phone.ok) return { ok: false, status: 400, error: phone.error };
  const body = text.trim();
  if (!body) return { ok: false, status: 400, error: "Treść nie może być pusta." };
  if (smsLength(body).segments > SMS_MAX_SEGMENTS) {
    return { ok: false, status: 400, error: `Za długa wiadomość (max ${SMS_MAX_SEGMENTS} części SMS).` };
  }

  const provider = getTelefonSmsProvider();
  const result = await provider.send(phone.e164, body);
  const db = (await getDb()) as AnyDb;
  const [row] = await db
    .insert(schema.phoneMessages)
    .values({
      direction: "out",
      phone: phone.e164,
      body,
      status: result.status === "sent" ? "wyslany" : result.status === "dry-run" ? "dry-run" : "blad",
      provider: provider.name,
      providerId: result.id,
      error: result.error ?? null,
      adminUserId: user.id,
      readAt: new Date(),
    })
    .returning({ id: schema.phoneMessages.id });

  await logAdminAction(user, {
    action: "telefon_sms",
    entityType: "phone_message",
    entityId: row.id,
    details: { status: result.status }, // numer i treść zostają tylko w phone_messages
  });
  if (result.status === "failed") return { ok: false, status: 502, error: result.error ?? "Nie wysłano." };
  return { ok: true, id: row.id, dryRun: result.status === "dry-run" };
}

/** Zapis SMS-a odebranego na telefonie UB (webhook). Idempotentny po `messageId`. */
export async function recordInboundSms(rawSender: string, text: string, messageId: string | null): Promise<void> {
  const phone = normalizeAnyPhone(rawSender);
  if (!phone) return;
  const db = (await getDb()) as AnyDb;
  await db
    .insert(schema.phoneMessages)
    .values({
      direction: "in",
      phone,
      body: text,
      status: "odebrany",
      provider: "smsgate",
      providerId: messageId,
    })
    .onConflictDoNothing();
}

/** Aktualizacja statusu wysłanej wiadomości (sent / delivered / failed) po `messageId`. */
export async function updateOutboundStatus(messageId: string, status: "wyslany" | "dostarczony" | "blad", error?: string): Promise<void> {
  const db = (await getDb()) as AnyDb;
  await db
    .update(schema.phoneMessages)
    .set({ status, error: error ?? null })
    .where(and(eq(schema.phoneMessages.direction, "out"), eq(schema.phoneMessages.providerId, messageId)));
}

export type Thread = { phone: string; label: string | null; lastBody: string; lastAt: Date; lastDirection: string; unread: number };

/** Etykiety z baz kontaktów (kursantki, trenerki, prospekty) po znormalizowanym numerze. */
export async function labelsFor(phones: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (phones.length === 0) return out;
  const want = new Set(phones);
  const db = (await getDb()) as AnyDb;
  const [leads, trainers, prospects] = await Promise.all([
    db.select({ name: schema.leads.name, phone: schema.leads.phone }).from(schema.leads).where(isNotNull(schema.leads.phone)),
    db.select({ name: schema.trainers.name, phone: schema.trainers.phone }).from(schema.trainers).where(isNotNull(schema.trainers.phone)),
    db.select({ name: schema.prospects.name, phone: schema.prospects.phone }).from(schema.prospects).where(isNotNull(schema.prospects.phone)),
  ]);
  const add = (rows: { name: string; phone: string | null }[], tag: string) => {
    for (const r of rows) {
      const p = normalizeAnyPhone(r.phone);
      if (p && want.has(p) && !out.has(p)) out.set(p, `${r.name} (${tag})`);
    }
  };
  add(leads, "kursantka");
  add(trainers, "trenerka");
  add(prospects, "akademia");
  return out;
}

export async function listThreads(limit = 50): Promise<Thread[]> {
  const db = (await getDb()) as AnyDb;
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (phone) phone, body AS last_body, created_at AS last_at, direction AS last_direction,
      (SELECT count(*)::int FROM phone_messages u WHERE u.phone = m.phone AND u.direction = 'in' AND u.read_at IS NULL) AS unread
    FROM phone_messages m
    ORDER BY phone, created_at DESC
  `);
  const list = (rows as unknown as { rows?: Record<string, unknown>[] }).rows ?? (rows as unknown as Record<string, unknown>[]);
  const threads = list
    .map((r) => ({
      phone: String(r.phone),
      label: null as string | null,
      lastBody: String(r.last_body),
      lastAt: new Date(r.last_at as string),
      lastDirection: String(r.last_direction),
      unread: Number(r.unread),
    }))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
    .slice(0, limit);
  const labels = await labelsFor(threads.map((t) => t.phone));
  for (const t of threads) t.label = labels.get(t.phone) ?? null;
  return threads;
}

export async function getThread(phone: string) {
  const db = (await getDb()) as AnyDb;
  const [messages, calls] = await Promise.all([
    db.select().from(schema.phoneMessages).where(eq(schema.phoneMessages.phone, phone)).orderBy(schema.phoneMessages.createdAt),
    db.select().from(schema.phoneCalls).where(eq(schema.phoneCalls.phone, phone)).orderBy(schema.phoneCalls.createdAt),
  ]);
  const labels = await labelsFor([phone]);
  return { messages, calls, label: labels.get(phone) ?? null };
}

export async function markThreadRead(phone: string): Promise<void> {
  const db = (await getDb()) as AnyDb;
  await db
    .update(schema.phoneMessages)
    .set({ readAt: new Date() })
    .where(and(eq(schema.phoneMessages.phone, phone), eq(schema.phoneMessages.direction, "in"), isNull(schema.phoneMessages.readAt)));
}

export const CALL_OUTCOMES = ["odebrala", "nieodebrala", "oddzwonic"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export async function logCall(user: User, rawPhone: string, outcome: CallOutcome, note: string | null): Promise<Fail | { ok: true; id: number }> {
  const phone = normalizeAnyPhone(rawPhone);
  if (!phone) return { ok: false, status: 400, error: "Nieprawidłowy numer." };
  const db = (await getDb()) as AnyDb;
  const [row] = await db
    .insert(schema.phoneCalls)
    .values({ phone, outcome, note: note?.trim() || null, adminUserId: user.id })
    .returning({ id: schema.phoneCalls.id });
  await logAdminAction(user, { action: "telefon_rozmowa", entityType: "phone_call", entityId: row.id, details: { outcome } });
  return { ok: true, id: row.id };
}

export async function unreadCount(): Promise<number> {
  const db = (await getDb()) as AnyDb;
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.phoneMessages)
    .where(and(eq(schema.phoneMessages.direction, "in"), isNull(schema.phoneMessages.readAt)));
  return r?.n ?? 0;
}

