import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { pipelineAddBoard } from "@/lib/pipeline";

export const runtime = "nodejs";

/** Nowa tablica (kategoria) dla istniejącej trenerki. */
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const parsed = z
    .object({ trainerId: z.number().int().positive(), category: z.string().trim().max(60) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  const res = await pipelineAddBoard(user, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res, { status: 201 });
}
