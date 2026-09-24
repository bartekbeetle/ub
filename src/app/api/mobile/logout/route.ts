import { NextResponse } from "next/server";
import { destroyMobileSession } from "@/lib/mobile-auth";

export const runtime = "nodejs";

/** Wylogowanie z telefonu — kasuje sesję po stronie serwera, nie tylko token w urządzeniu. */
export async function POST(req: Request) {
  await destroyMobileSession(req);
  return NextResponse.json({ ok: true });
}
