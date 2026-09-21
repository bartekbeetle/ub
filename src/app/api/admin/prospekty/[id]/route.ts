import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { prospectPatchSchema, prospectQuickActionSchema, zodErrorMessage } from "@/lib/validators";
import { addWarsawDays, prospectValuesFromPayload, logProspectActivity } from "@/lib/prospects";
import { formatDate } from "@/lib/utils";
import { PROSPECT_STATUS_LABELS } from "@/lib/constants";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const prospectId = Number(id);
  if (!Number.isInteger(prospectId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.prospects).where(eq(schema.prospects.id, prospectId)).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const prospectId = Number(id);
  if (!Number.isInteger(prospectId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const body = await req.json().catch(() => null);

  // Szybkie akcje z bloku „Do zadzwonienia" — sprawdzane PRZED `prospectPatchSchema` celowo:
  // ten drugi jest `.partial()` i po cichu ODRZUCA nieznane klucze zamiast zwrócić błąd, więc
  // payload `{quickAction, days}` przeszedłby jako pusty obiekt i PATCH zwróciłby 200 bez zmiany.
  if (body && typeof body === "object" && "quickAction" in body) {
    const parsedAction = prospectQuickActionSchema.safeParse(body);
    if (!parsedAction.success) return NextResponse.json({ error: zodErrorMessage(parsedAction.error) }, { status: 400 });

    const db = await getDb();
    const rows = await db.select().from(schema.prospects).where(eq(schema.prospects.id, prospectId)).limit(1);
    const prospect = rows[0];
    if (!prospect) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

    const now = new Date();
    let nextActionAt: Date;
    let activityType: typeof schema.prospectActivities.$inferInsert.type;
    let activityContent: string;
    let touchLastContact = false;

    if (parsedAction.data.quickAction === "dzwonilem") {
      nextActionAt = addWarsawDays(parsedAction.data.days, 9, 0, now);
      activityType = "telefon";
      activityContent = `Telefon wykonany — oddzwonić ${formatDate(nextActionAt)}.`;
      touchLastContact = true;
    } else if (parsedAction.data.quickAction === "nie_odbiera") {
      nextActionAt = addWarsawDays(1, 9, 0, now);
      activityType = "telefon";
      activityContent = "Nie odbiera.";
      touchLastContact = true;
    } else {
      nextActionAt = addWarsawDays(14, 9, 0, now);
      activityType = "notatka";
      activityContent = `Odłożone na ${formatDate(nextActionAt)}.`;
      touchLastContact = false;
    }

    const [updated] = await db
      .update(schema.prospects)
      .set({
        nextActionAt,
        ...(touchLastContact ? { lastContactAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(schema.prospects.id, prospectId))
      .returning();

    // Wpis na oś czasu przez logProspectActivity (nie duplikujemy tu ustawienia lastContactAt —
    // już ustawione wyżej w JEDNYM `db.update`, z tym samym `now`).
    await logProspectActivity({
      prospectId,
      type: activityType,
      content: activityContent,
      createdBy: user.email,
    });
    await logAudit({
      actor: actorLabel(user),
      action: `prospekt_szybka_akcja_${parsedAction.data.quickAction}`,
      entityType: "prospect",
      entityId: prospectId,
      details: { nextActionAt },
    });

    return NextResponse.json(updated);
  }

  const parsed = prospectPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.prospects).where(eq(schema.prospects.id, prospectId)).limit(1);
  const prospect = rows[0];
  if (!prospect) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  const values = prospectValuesFromPayload(parsed.data as Record<string, unknown>);
  if (Object.keys(values).length === 0) return NextResponse.json(prospect);

  // Każde dotknięcie sekcji BUR = świeża data weryfikacji. Bez tego nie wiadomo,
  // czy „segment A" pochodzi ze sprawdzenia sprzed tygodnia czy sprzed pół roku.
  const burTouched = [
    "burSegment",
    "burProviderId",
    "burUrl",
    "burServicesCompleted",
    "burServicesActive",
    "burRatingX10",
    "burReviewCount",
  ].some((k) => k in values);
  if (burTouched) values.burCheckedAt = new Date();
  if ("researchNotes" in values || "dossierPath" in values) values.researchedAt = new Date();
  values.updatedAt = new Date();

  const [updated] = await db
    .update(schema.prospects)
    .set(values)
    .where(eq(schema.prospects.id, prospectId))
    .returning();

  if (values.status && values.status !== prospect.status) {
    await logProspectActivity({
      prospectId,
      type: "zmiana_statusu",
      content: `Status: ${PROSPECT_STATUS_LABELS[prospect.status] ?? prospect.status} → ${
        PROSPECT_STATUS_LABELS[values.status] ?? values.status
      }`,
      createdBy: user.email,
    });
    await logAudit({
      actor: actorLabel(user),
      action: "prospekt_zmiana_statusu",
      entityType: "prospect",
      entityId: prospectId,
      details: { from: prospect.status, to: values.status },
    });
  } else {
    await logAudit({
      actor: actorLabel(user),
      action: "prospekt_edytowany",
      entityType: "prospect",
      entityId: prospectId,
      details: { pola: Object.keys(values) },
    });
  }

  return NextResponse.json(updated);
}
