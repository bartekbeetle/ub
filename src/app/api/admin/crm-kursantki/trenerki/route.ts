import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { pipelineCreateTrainer } from "@/lib/pipeline";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(160),
  categories: z.array(z.string().trim().max(60)).min(1).max(20),
  city: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
});

/** „Dodaj trenerkę" z CRM-u kursantek: trenerka bez umowy + tablica na każdą kategorię. Nic nie wysyła. */
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Podaj nazwę i przynajmniej jedną kategorię." }, { status: 400 });
  const res = await pipelineCreateTrainer(user, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res, { status: 201 });
}
