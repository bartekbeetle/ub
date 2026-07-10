import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { leadSchema } from "@/lib/validators";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { distributeLead } from "@/lib/matching";
import { logAudit } from "@/lib/audit";

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
    return NextResponse.json({ error: first?.message ?? "Nieprawidłowe dane formularza." }, { status: 400 });
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
      courseId: data.courseId ?? null,
      source: data.source,
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
      status: "nowy",
      rodoConsentAt: new Date(),
    })
    .returning();

  await logAudit({
    actor: "system",
    action: "lead_utworzony",
    entityType: "lead",
    entityId: lead.id,
    details: { source: data.source, category: data.category, voivodeship: data.voivodeship },
  });

  // automatyczna dystrybucja (nie blokuje odpowiedzi przy błędzie)
  try {
    await distributeLead(lead);
  } catch (err) {
    console.error("[lead] Błąd dystrybucji:", err);
  }

  return NextResponse.json({ ok: true, id: lead.id });
}
