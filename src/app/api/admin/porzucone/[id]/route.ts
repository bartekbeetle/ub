import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

/**
 * Trwałe usunięcie porzuconej aplikacji (`quiz_sessions`) — rekordy testowe i śmieciowe,
 * które zawyżają licznik porzuconych w lejku.
 *
 * Dokończonej aplikacji tą drogą nie kasujemy: ona jest źródłem leada (`leadId`), a lead
 * ma własne „Usuń” i własną ścieżkę RODO. Ślad zostaje w dzienniku adminów, zapisany PRZED
 * kasowaniem.
 */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.quizSessions).where(eq(schema.quizSessions.id, sessionId)).limit(1);
  const sesja = rows[0];
  if (!sesja) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  if (sesja.completed || sesja.leadId) {
    return NextResponse.json(
      { error: "To dokończona aplikacja (jest z niej lead). Usuń leada, nie aplikację." },
      { status: 409 }
    );
  }

  await logAdminAction(user, { action: "usuniecie_porzuconej_aplikacji",
    entityType: "quiz_session",
    entityId: sessionId,
    details: {
      name: sesja.name,
      category: sesja.category,
      maxStepReached: sesja.maxStepReached,
      createdAt: sesja.createdAt?.toISOString?.() ?? null,
    },
  });

  await db.delete(schema.quizSessions).where(eq(schema.quizSessions.id, sessionId));
  return NextResponse.json({ ok: true });
}
