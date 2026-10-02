import { z } from "zod";
import { CRM_STAGES } from "@/lib/crm-core";
import { crmChangeStage } from "@/lib/crm";
import { BAD_INPUT, respond, withTrainer } from "@/lib/crm-api";

export const runtime = "nodejs";

const schema = z.object({
  stage: z.enum(CRM_STAGES),
  rejectionReason: z.string().max(1000).optional(),
});

/** Zmiana etapu CRM. Etapy zmieniające status (zapisana, rezygnacja, nowa) idą przez wspólną funkcję naliczającą. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withTrainer(params, "id", async (user, id) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return BAD_INPUT();
    return respond(await crmChangeStage(user, id, parsed.data));
  });
}
