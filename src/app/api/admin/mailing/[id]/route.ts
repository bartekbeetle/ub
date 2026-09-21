import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { mailingCampaignSchema, zodErrorMessage } from "@/lib/validators";
import { campaignStats } from "@/lib/mailing";
import { isSmtpConfigured } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Zła ścieżka." }, { status: 400 });

  const db = await getDb();
  const [campaign] = await db
    .select()
    .from(schema.mailingCampaigns)
    .where(eq(schema.mailingCampaigns.id, id))
    .limit(1);
  if (!campaign) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  const recipients = await db
    .select()
    .from(schema.mailingRecipients)
    .where(eq(schema.mailingRecipients.campaignId, id))
    .orderBy(asc(schema.mailingRecipients.id))
    .limit(500);

  return NextResponse.json({
    campaign,
    stats: await campaignStats(id),
    smtpReady: isSmtpConfigured(),
    recipients,
  });
}

/** Edycja treści — tylko dopóki lista odbiorców nie jest zamrożona. */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Zła ścieżka." }, { status: 400 });

  const parsed = mailingCampaignSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }

  const db = await getDb();
  const [campaign] = await db
    .select()
    .from(schema.mailingCampaigns)
    .where(eq(schema.mailingCampaigns.id, id))
    .limit(1);
  if (!campaign) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  // Po zamrożeniu listy treść jest już częściowo wysłana — zmiana oznaczałaby, że dwie osoby
  // z jednej kampanii dostały dwie różne wiadomości, a my nie wiemy która co.
  if (campaign.status !== "szkic") {
    return NextResponse.json(
      { error: "Kampania ma zamrożoną listę odbiorców — treści nie można już zmienić." },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(schema.mailingCampaigns)
    .set({
      ...parsed.data,
      segment: (parsed.data.segment ?? campaign.segment) as Record<string, unknown>,
    })
    .where(eq(schema.mailingCampaigns.id, id))
    .returning();

  await logAudit({
    actor: actorLabel(user),
    action: "mailing_kampania_zmieniona",
    entityType: "mailing_campaign",
    entityId: id,
    details: parsed.data,
  });

  return NextResponse.json(updated);
}

/** Usunięcie kampanii. Zablokowane, gdy cokolwiek już poszło — to byłoby kasowanie dowodu wysyłki. */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Zła ścieżka." }, { status: 400 });

  const stats = await campaignStats(id);
  if (stats.total > 0 && stats.oczekuje < stats.total) {
    return NextResponse.json(
      { error: "Z tej kampanii już wychodziły wiadomości — nie można jej usunąć." },
      { status: 409 }
    );
  }

  const db = await getDb();
  // Odbiorcy lecą kaskadą (FK ON DELETE CASCADE).
  await db.delete(schema.mailingCampaigns).where(eq(schema.mailingCampaigns.id, id));
  await logAudit({
    actor: actorLabel(user),
    action: "mailing_kampania_usunieta",
    entityType: "mailing_campaign",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
