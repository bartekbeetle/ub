import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { loadResumeByToken } from "@/lib/abandoned-core";

/**
 * Wznowienie porzuconej aplikacji z linku w mailu przypominającym.
 *
 * Token jest losowy (32 bajty) i jednorazowo wydany do jednego adresu; w URL nie ma ani
 * adresu, ani identyfikatora sesji. Odpowiedź zawiera tylko to, co kobieta sama wpisała
 * w formularzu, i tylko dla niedokończonej aplikacji w ciągu 14 dni od przypomnienia.
 * Każda inna sytuacja to jednakowe `{ ok: false }`, żeby nie dało się sprawdzać tokenów.
 */
const bodySchema = z.object({ token: z.string().min(32).max(80) });

export async function POST(request: Request) {
  if (!rateLimit(`resume:${getClientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  let token: string;
  try {
    token = bodySchema.parse(await request.json()).token;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const session = await loadResumeByToken(await getDb(), token);
    if (!session) return NextResponse.json({ ok: false });
    const { website: _honeypot, ...answers } = (session.answers ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      sessionKey: session.sessionKey,
      step: Math.min(session.maxStepReached + 1, 7),
      answers,
    });
  } catch (e) {
    console.error("[quiz-resume]", e);
    return NextResponse.json({ ok: false });
  }
}
