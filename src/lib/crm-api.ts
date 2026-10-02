import "server-only";
import { NextResponse } from "next/server";
import { requireTrainer } from "@/lib/auth";
import type { User } from "@/db/schema";

/**
 * Wspólny szkielet tras `/api/panel/crm/*`: sesja trenerki (z bramką hasła startowego),
 * parsowanie id i zamiana wyniku rdzenia na odpowiedź HTTP. Id przydziału z adresu NIGDY nie
 * jest zaufane — rdzeń zawsze łączy je z `trainerId` z sesji, więc cudzy przydział = 404.
 */
export async function withTrainer(
  params: Promise<{ id?: string; tid?: string }>,
  key: "id" | "tid",
  handler: (user: User, id: number) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await requireTrainer();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const id = Number((await params)[key]);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  return handler(user, id);
}

export function respond<T extends { ok: boolean }>(result: T): NextResponse {
  if (result.ok) return NextResponse.json(result);
  const f = result as unknown as { status: number; error: string };
  return NextResponse.json({ error: f.error }, { status: f.status });
}

export const BAD_INPUT = () => NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
