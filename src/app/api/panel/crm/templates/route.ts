import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTrainer } from "@/lib/auth";
import { crmTrenerkiEnabled } from "@/lib/crm-flag";
import { getDb } from "@/db";
import { createTemplate, listTemplates } from "@/lib/crm-core";
import { BAD_INPUT, respond } from "@/lib/crm-api";

export const runtime = "nodejs";

const templateSchema = z.object({
  channel: z.enum(["email", "sms"]),
  name: z.string().min(1).max(120),
  subject: z.string().max(400).nullish(),
  body: z.string().min(1).max(5000),
});

export async function GET() {
  if (!crmTrenerkiEnabled()) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  const user = await requireTrainer();
  if (!user?.trainerId) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  return NextResponse.json(await listTemplates(await getDb(), user.trainerId));
}

export async function POST(req: Request) {
  if (!crmTrenerkiEnabled()) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  const user = await requireTrainer();
  if (!user?.trainerId) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const parsed = templateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return BAD_INPUT();
  return respond(await createTemplate(await getDb(), user.trainerId, parsed.data));
}
