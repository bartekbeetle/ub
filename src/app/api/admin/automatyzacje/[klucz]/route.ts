import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { zodErrorMessage } from "@/lib/validators";
import { isSmtpConfigured, sendOrQueueEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/template";
import { automationDef, missingRequired, resolveAutomation, saveAutomation, type AutomationKey } from "@/lib/automations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ klucz: string }>;

// Guardrail UB (voice.md): nigdy „0 zł” ani „za darmo” — dofinansowanie zawsze „nawet do 95%”.
const FORBIDDEN = [/\b0\s?zł/i, /za darmo/i, /bezpłatn/i];

const patchSchema = z.object({
  subject: z.string().trim().min(3, "Temat jest za krótki").max(300).optional(),
  body: z.string().trim().min(10, "Treść jest za krótka").max(10_000).optional(),
  enabled: z.boolean().optional(),
  reset: z.boolean().optional(),
});

/** Zapis treści / włącznika automatu (Mailing → Automatyzacje). */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const def = automationDef((await params).klucz);
  if (!def) return NextResponse.json({ error: "Nie ma takiego automatu." }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  const d = parsed.data;

  if (d.subject !== undefined || d.body !== undefined) {
    const text = `${d.subject ?? ""}\n${d.body ?? ""}`;
    if (FORBIDDEN.some((re) => re.test(text))) {
      return NextResponse.json(
        { error: "Treść obiecuje darmowy kurs („0 zł”, „za darmo”, „bezpłatny”). W UB piszemy „nawet do 95%”." },
        { status: 400 }
      );
    }
    if (d.subject !== undefined && d.body !== undefined) {
      const missing = missingRequired(def, d.subject, d.body);
      if (missing.length) {
        return NextResponse.json(
          { error: `Brakuje obowiązkowych pól: ${missing.map((m) => `{{${m}}}`).join(", ")}.` },
          { status: 400 }
        );
      }
    }
  }
  if (d.reset && def.settingsFields) {
    return NextResponse.json({ error: "Ten automat nie ma treści domyślnej do przywrócenia." }, { status: 400 });
  }

  await saveAutomation(def.key as AutomationKey, d, user.email);
  await logAdminAction(user, {
    action: d.enabled !== undefined && d.subject === undefined ? "automat_wlacznik" : "automat_tresc",
    entityType: "automation",
    details: { kind: def.key, enabled: d.enabled, reset: d.reset ?? false },
  });
  return NextResponse.json({ ok: true, automation: await resolveAutomation(def.key as AutomationKey) });
}

const testSchema = z.object({
  to: z.string().trim().email("Podaj poprawny adres e-mail"),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(10_000),
});

/** Mail próbny z przykładowymi danymi — przed zapisem, z tego, co jest w edytorze. */
export async function POST(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const def = automationDef((await params).klucz);
  if (!def) return NextResponse.json({ error: "Nie ma takiego automatu." }, { status: 404 });
  const parsed = testSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "Brak konfiguracji SMTP — test trafiłby do kolejki, a nie na skrzynkę." }, { status: 409 });
  }

  const res = await sendOrQueueEmail({
    to: parsed.data.to,
    subject: `[TEST] ${renderTemplate(parsed.data.subject, def.sample)}`,
    body: renderTemplate(parsed.data.body, def.sample),
    dedupe: false,
  });
  await logAdminAction(user, { action: "automat_test", entityType: "automation", details: { kind: def.key, to: parsed.data.to } });
  return res.sent
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Serwer pocztowy odrzucił wysyłkę — szczegóły w zakładce Wysłane." }, { status: 502 });
}
