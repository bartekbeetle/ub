import { z } from "zod";
import { crmSendEmail } from "@/lib/crm";
import { BAD_INPUT, respond, withTrainer } from "@/lib/crm-api";

export const runtime = "nodejs";

const schema = z.object({ subject: z.string().min(1).max(400), body: z.string().min(1).max(8000) });

/** Jedna wiadomość do jednej kursantki z jej karty. Brak wysyłki hurtowej — celowo (patrz `sendCrmEmail`). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withTrainer(params, "id", async (user, id) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return BAD_INPUT();
    return respond(await crmSendEmail(user, id, parsed.data.subject, parsed.data.body));
  });
}
