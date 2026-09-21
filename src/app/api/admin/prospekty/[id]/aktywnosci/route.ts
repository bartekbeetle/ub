import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { prospectActivitySchema, zodErrorMessage } from "@/lib/validators";
import { PROSPECT_CONTACT_ACTIVITY_TYPES } from "@/lib/prospects";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const prospectId = Number(id);
  if (!Number.isInteger(prospectId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const parsed = prospectActivitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });

  const db = await getDb();
  const exists = await db
    .select({ id: schema.prospects.id })
    .from(schema.prospects)
    .where(eq(schema.prospects.id, prospectId))
    .limit(1);
  if (!exists[0]) return NextResponse.json({ error: "Nie znaleziono prospekta." }, { status: 404 });

  const [created] = await db
    .insert(schema.prospectActivities)
    .values({
      prospectId,
      type: parsed.data.type as typeof schema.prospectActivities.$inferInsert.type,
      content: parsed.data.content,
      createdBy: user.email,
    })
    .returning();

  // Aktywność = realny ruch na prospekcie, więc odświeżamy `updatedAt`, żeby sortowanie
  // „ostatnio ruszone" pokazywało prawdę. Telefon/e-mail/spotkanie to REALNY kontakt — dopisujemy
  // `lastContactAt`, żeby blok „Do zadzwonienia" wiedział, że ktoś już próbował. Notatka nie liczy się.
  const now = new Date();
  const isContact = PROSPECT_CONTACT_ACTIVITY_TYPES.has(parsed.data.type);
  await db
    .update(schema.prospects)
    .set({ updatedAt: now, ...(isContact ? { lastContactAt: now } : {}) })
    .where(eq(schema.prospects.id, prospectId));

  return NextResponse.json(created, { status: 201 });
}
