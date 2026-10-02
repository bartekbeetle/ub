import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { requireTrainerMobile, ONBOARDING_GATE_MESSAGE } from "@/lib/mobile-auth";
import { getCrmDetail } from "@/lib/crm-core";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

/**
 * Karta CRM kursantki dla aplikacji mobilnej — TYLKO ODCZYT (etap, przypomnienie, historia).
 * Ta sama funkcja i ta sama izolacja co strona `/panel/leady/[id]`: przydział łączony po
 * `trainer.id` z tokenu, cudzy przydział = 404. Zapisu z telefonu (notatki, wiadomości) celowo
 * jeszcze nie ma. Zmiana etapu na „zapisana" nadal idzie przez istniejące PATCH `/api/mobile/leady/[id]`.
 */
export async function GET(req: Request, { params }: { params: Params }) {
  const auth = await requireTrainerMobile(req);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  if (!auth.trainer.isActive) return NextResponse.json({ error: ONBOARDING_GATE_MESSAGE }, { status: 403 });

  const assignmentId = Number((await params).id);
  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  }
  const detail = await getCrmDetail(await getDb(), auth.trainer.id, assignmentId);
  if (!detail) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  return NextResponse.json(detail);
}
