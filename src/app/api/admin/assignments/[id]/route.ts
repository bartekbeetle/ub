import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isSuperadminRole, stripBilling } from "@/lib/roles";
import { updateAssignmentStatusAsAdmin } from "@/lib/assignment-status";
import { z } from "zod";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

const patchSchema = z.object({
  status: z.enum(["przydzielony", "skontaktowany", "zapisana", "odrzucony"]).optional(),
  rejectionReason: z.string().max(1000).optional(),
  billingStatus: z.enum(["do_zafakturowania", "zafakturowane", "oplacone"]).optional(),
});

/**
 * Zmiana statusu przydziału (per trenerka) — zasila rozliczenia (attribution).
 * Naliczanie, eskalacja leada, audyt i maile leżą we wspólnym rdzeniu
 * (`@/lib/assignment-status-core`) — ta trasa pilnuje tylko uprawnień admina.
 */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const assignmentId = Number(id);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(assignmentId) || !parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  // Status płatności (rozliczenia) zmienia wyłącznie superadmin. Status przydziału
  // (przydzielony → zapisana) to praca operacyjna admina i zostaje mu dostępny;
  // cofnięcie „zapisana" rdzeń odmawia zwykłemu adminowi (403).
  if (parsed.data.billingStatus && !isSuperadminRole(user.role)) {
    return NextResponse.json({ error: "Status płatności zmienia tylko superadmin." }, { status: 403 });
  }

  const result = await updateAssignmentStatusAsAdmin({ user, assignmentId, change: parsed.data });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(stripBilling(result.assignment, user.role));
}
