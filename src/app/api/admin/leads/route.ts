import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const db = await getDb();
  const leads = await db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(500);
  return NextResponse.json(leads);
}
