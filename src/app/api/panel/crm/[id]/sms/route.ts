import { z } from "zod";
import { crmSendSms } from "@/lib/crm";
import { BAD_INPUT, respond, withTrainer } from "@/lib/crm-api";

export const runtime = "nodejs";

const schema = z.object({ text: z.string().min(1).max(1000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withTrainer(params, "id", async (user, id) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return BAD_INPUT();
    return respond(await crmSendSms(user, id, parsed.data.text));
  });
}
