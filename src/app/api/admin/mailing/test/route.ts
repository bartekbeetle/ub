import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { zodErrorMessage } from "@/lib/validators";
import { isSmtpConfigured, sendMarketingEmail } from "@/lib/email";
import { recipientVars } from "@/lib/mailing";
import { renderTemplate } from "@/lib/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().trim().email("Podaj poprawny adres e-mail"),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(50000),
});

/**
 * Wysyłka próbna na wskazany adres — zanim pójdzie do listy.
 *
 * Leci tą samą ścieżką co prawdziwy mailing (`sendMarketingEmail`), więc test sprawdza
 * także stopkę i nagłówki rezygnacji, a nie tylko samo połączenie z serwerem.
 * `dedupe: false`, bo inaczej druga próba na ten sam adres zostałaby po cichu pominięta.
 */
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Brak konfiguracji SMTP (SMTP_HOST / SMTP_USER / SMTP_PASS). Wiadomość trafiłaby do kolejki, a nie na skrzynkę — test nic by nie sprawdził.",
      },
      { status: 409 }
    );
  }

  const vars = recipientVars({
    name: "Anna Nowak",
    email: parsed.data.to,
    category: "Stylizacja brwi",
    voivodeship: "slaskie",
  });

  const res = await sendMarketingEmail({
    to: parsed.data.to,
    subject: `[TEST] ${renderTemplate(parsed.data.subject, vars)}`,
    body: renderTemplate(parsed.data.body, vars),
    dedupe: false,
  });

  if (res.skipped) {
    return NextResponse.json(
      { ok: false, error: `Nie wysłano: ${res.reason ?? "adres pominięty"}.` },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: res.sent,
    error: res.sent ? undefined : "Wiadomość trafiła do kolejki — serwer pocztowy jej nie przyjął.",
  });
}
