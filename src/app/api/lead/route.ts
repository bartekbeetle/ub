import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { leadSchema } from "@/lib/validators";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { distributeLead } from "@/lib/matching";
import { sendLeadConfirmation } from "@/lib/lead-events";
import { logAudit } from "@/lib/audit";
import { CONSENT_VERSION } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`lead:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Zbyt wiele zgłoszeń. Spróbuj za chwilę." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    // `field` pozwala formularzowi podświetlić konkretne pole zamiast wyrzucać ogólny błąd na górze.
    return NextResponse.json(
      { error: first?.message ?? "Nieprawidłowe dane formularza.", field: first?.path?.[0] ?? null },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // honeypot wypełniony -> udajemy sukces, nie zapisujemy
  if (data.website && data.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const db = await getDb();
  const [lead] = await db
    .insert(schema.leads)
    .values({
      name: data.name,
      phone: data.phone,
      email: data.email,
      voivodeship: data.voivodeship,
      category: data.category,
      employmentStatus: data.employmentStatus,
      preferredDate: data.preferredDate || null,
      city: data.city || null,
      hasBusinessActivity: data.hasBusinessActivity ?? null,
      travelKm: data.travelKm ?? null,
      message: data.message || null,
      courseId: data.courseId ?? null,
      source: data.source,
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
      status: "nowy",
      // Znacznik czasu zapisujemy osobno dla każdej zgody — to jest dowód rozliczalności.
      // Marketingowa jest dobrowolna, więc bez niej zostaje NULL (a nie „false").
      rodoConsentAt: new Date(),
      contactConsentAt: new Date(),
      marketingConsentAt: data.marketingConsent ? new Date() : null,
      consentVersion: CONSENT_VERSION,
    })
    .returning();

  await logAudit({
    actor: "system",
    action: "lead_utworzony",
    entityType: "lead",
    entityId: lead.id,
    details: { source: data.source, category: data.category, voivodeship: data.voivodeship },
  });

  // 🔴 22.09.2026: nowy lead NIE zakłada już zadania w kolejce researchu — kolejka usunięta
  // w całości (decyzja Bartka). Powód: mieliła 3–5 akademii dziennie, baza urosła 7 → 15,
  // a kontaktowanych było zero. Brakuje telefonów do akademii, które już mamy, nie akademii.
  // Lead bez adresata widać teraz tam, gdzie jest realnym problemem: w lejku kursantek
  // („X zł leży bez adresata") i w kolejce telefonów w CRM trenerek.
  // Tabela `research_jobs` i jej wiersze ZOSTAJĄ w bazie — nic nie kasujemy z danych.

  // Potwierdzenie dla kursantki. Leci PRZED dystrybucją, bo jest niezależne od tego,
  // czy znaleźliśmy jej akademię — a najczęściej nie znajdujemy (6 z 13 leadów w panelu
  // nie ma dziś adresata). Właśnie wtedy cisza po zgłoszeniu boli najbardziej.
  // Funkcja łapie własne błędy, więc nie potrzebuje try/catch.
  await sendLeadConfirmation(lead);

  // automatyczna dystrybucja (nie blokuje odpowiedzi przy błędzie)
  try {
    await distributeLead(lead);
  } catch (err) {
    console.error("[lead] Błąd dystrybucji:", err);
  }

  return NextResponse.json({ ok: true, id: lead.id });
}
