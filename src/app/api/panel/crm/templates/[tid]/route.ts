import { z } from "zod";
import { getDb } from "@/db";
import { deleteTemplate, updateTemplate } from "@/lib/crm-core";
import { BAD_INPUT, respond, withTrainer } from "@/lib/crm-api";

export const runtime = "nodejs";

const schema = z.object({
  channel: z.enum(["email", "sms"]),
  name: z.string().min(1).max(120),
  subject: z.string().max(400).nullish(),
  body: z.string().min(1).max(5000),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ tid: string }> }) {
  return withTrainer(params, "tid", async (user, tid) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return BAD_INPUT();
    return respond(await updateTemplate(await getDb(), user.trainerId!, tid, parsed.data));
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ tid: string }> }) {
  return withTrainer(params, "tid", async (user, tid) => respond(await deleteTemplate(await getDb(), user.trainerId!, tid)));
}
