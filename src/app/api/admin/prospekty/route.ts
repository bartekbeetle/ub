import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { prospectSchema } from "@/lib/validators";
import { zodErrorMessage } from "@/lib/validators";
import { prospectValuesFromPayload, logProspectActivity } from "@/lib/prospects";
import { PROSPECT_STATUS_LABELS } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const db = await getDb();
  return NextResponse.json(await db.select().from(schema.prospects).orderBy(desc(schema.prospects.createdAt)));
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const parsed = prospectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }

  const db = await getDb();
  const values = prospectValuesFromPayload(parsed.data as Record<string, unknown>);
  if (!values.name) return NextResponse.json({ error: "Podaj nazwę podmiotu." }, { status: 400 });

  const [created] = await db
    .insert(schema.prospects)
    .values({ ...values, name: values.name })
    .returning();

  await logProspectActivity({
    prospectId: created.id,
    type: "zmiana_statusu",
    content: `Prospekt utworzony ze statusem „${PROSPECT_STATUS_LABELS[created.status] ?? created.status}".`,
    createdBy: user.email,
  });
  await logAudit({
    actor: actorLabel(user),
    action: "prospekt_utworzony",
    entityType: "prospect",
    entityId: created.id,
    details: { name: created.name, status: created.status, burSegment: created.burSegment },
  });

  return NextResponse.json(created, { status: 201 });
}
