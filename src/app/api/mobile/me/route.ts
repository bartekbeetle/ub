import { NextResponse } from "next/server";
import { requireTrainerMobile } from "@/lib/mobile-auth";

export const runtime = "nodejs";

/**
 * Stan sesji przy starcie aplikacji — SERWER jest tu źródłem prawdy, nie telefon.
 *
 * Powód: `mustChangePassword` zmienia się także poza aplikacją (zmiana hasła w panelu
 * webowym), a telefon trzymający własną kopię tej flagi trafia w jedną z dwóch pułapek:
 * flaga stale `false` → aplikacja wchodzi na listę, dostaje 401 i wylogowuje w kółko;
 * flaga stale `true` → trenerka siedzi na ekranie zmiany hasła, którego już nie zmieni,
 * bo stare hasło nie działa.
 *
 * `allowPasswordChange: true` — konto z hasłem startowym MUSI móc odpytać ten endpoint,
 * inaczej nie dowiedziałoby się, że ma zmienić hasło.
 */
export async function GET(req: Request) {
  const auth = await requireTrainerMobile(req, { allowPasswordChange: true });
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  return NextResponse.json({
    mustChangePassword: auth.user.mustChangePassword,
    trainer: {
      name: auth.trainer.name,
      isActive: auth.trainer.isActive,
      billingModel: auth.trainer.billingModel,
      rate: auth.trainer.rate,
    },
  });
}
