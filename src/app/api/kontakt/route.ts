import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { submissionSchema } from "@/lib/validators";
import { rateLimit, getClientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`kontakt:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Zbyt wiele zgłoszeń. Spróbuj za chwilę." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane formularza." }, { status: 400 });
  }
  const data = parsed.data;
  if (data.website && data.website.length > 0) return NextResponse.json({ ok: true });

  const db = await getDb();
  await db.insert(schema.submissions).values({
    type: data.type,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    message: data.message || null,
  });

  return NextResponse.json({ ok: true });
}
