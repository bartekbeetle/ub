import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { mailingCampaignSchema, zodErrorMessage } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista kampanii z licznikiem odbiorców — do tabeli na `/admin/mailing`. */
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select({
      campaign: schema.mailingCampaigns,
      recipients: sql<number>`count(${schema.mailingRecipients.id})::int`,
    })
    .from(schema.mailingCampaigns)
    .leftJoin(
      schema.mailingRecipients,
      eq(schema.mailingRecipients.campaignId, schema.mailingCampaigns.id)
    )
    .groupBy(schema.mailingCampaigns.id)
    .orderBy(desc(schema.mailingCampaigns.id));

  return NextResponse.json(rows.map((r) => ({ ...r.campaign, recipients: r.recipients })));
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const parsed = mailingCampaignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }

  const db = await getDb();
  const [created] = await db
    .insert(schema.mailingCampaigns)
    .values({
      name: parsed.data.name,
      subject: parsed.data.subject,
      body: parsed.data.body,
      segment: parsed.data.segment as Record<string, unknown>,
      createdBy: actorLabel(user),
    })
    .returning();

  await logAudit({
    actor: actorLabel(user),
    action: "mailing_kampania_utworzona",
    entityType: "mailing_campaign",
    entityId: created.id,
    details: { name: created.name, segment: created.segment },
  });

  return NextResponse.json(created, { status: 201 });
}
