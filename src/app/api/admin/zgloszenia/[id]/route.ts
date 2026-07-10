import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
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
