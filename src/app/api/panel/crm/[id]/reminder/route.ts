import { z } from "zod";
import { crmSetReminder } from "@/lib/crm";
import { BAD_INPUT, respond, withTrainer } from "@/lib/crm-api";

export const runtime = "nodejs";

/** `date` w formacie RRRR-MM-DD albo `null` (kasuje przypomnienie). */
const schema = z.object({ date: z.string().max(10).nullable() });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withTrainer(params, "id", async (user, id) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return BAD_INPUT();
    return respond(await crmSetReminder(user, id, parsed.data.date || null));
  });
}
