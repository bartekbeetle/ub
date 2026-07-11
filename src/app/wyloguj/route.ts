import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Awaryjne wylogowanie z paska adresu (GET) — działa niezależnie od stanu JS w karcie.
 * Po skasowaniu sesji odsyła na stronę logowania panelu trenerki.
 */
export async function GET(req: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/panel/login", req.url));
}
