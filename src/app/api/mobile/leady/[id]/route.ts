import { NextResponse } from "next/server";
import { requireTrainerMobile } from "@/lib/mobile-auth";
import { assignmentStatusSchema, updateTrainerAssignmentStatus } from "@/lib/assignment-status";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

/**
 * Zmiana statusu przydziału z telefonu. Cała logika (izolacja, bramka onboardingu,
 * naliczanie należności, maile do kursantki) leży we wspólnym `@/lib/assignment-status`,
 * dzielonym z panelem webowym.
 */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const auth = await requireTrainerMobile(req);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const { id } = await params;
  const parsed = assignmentStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const result = await updateTrainerAssignmentStatus({
    user: auth.user,
    trainerId: auth.trainer.id,
    assignmentId: Number(id),
    input: parsed.data,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.assignment);
}
