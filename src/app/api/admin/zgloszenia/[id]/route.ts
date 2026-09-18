import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const subId = Number(id);
  const parsed = z.object({ isHandled: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(subId) || !parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const db = await getDb();
  const [updated] = await db
    .update(schema.submissions)
    .set({ isHandled: parsed.data.isHandled })
    .where(eq(schema.submissions.id, subId))
    .returning();
  if (!updated) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  return NextResponse.json(updated);
}

/**
 * Trwałe usunięcie zgłoszenia — dla rekordów testowych i śmieciowych.
 * Zgłoszenie przekonwertowane na leada zostaje: kasowanie go zerwałoby ślad pochodzenia
 * leada, który może być już w rozliczeniu. Najpierw skasuj leada, potem zgłoszenie.
 * Ślad po usunięciu ląduje w `audit_log` przed skasowaniem wiersza.
 */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const subId = Number(id);
  if (!Number.isInteger(subId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.submissions).where(eq(schema.submissions.id, subId)).limit(1);
  const submission = rows[0];
  if (!submission) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  if (submission.convertedToLeadId) {
    return NextResponse.json(
      { error: `Zgłoszenie jest źródłem leada #${submission.convertedToLeadId}. Usuń najpierw tego leada.` },
      { status: 409 }
    );
  }

  await logAudit({
    actor: actorLabel(user),
    action: "usuniecie_zgloszenia",
    entityType: "submission",
    entityId: subId,
    details: {
      name: submission.name,
      type: submission.type,
      createdAt: submission.createdAt?.toISOString?.() ?? null,
    },
  });

  await db.delete(schema.submissions).where(eq(schema.submissions.id, subId));

  return NextResponse.json({ ok: true });
}
