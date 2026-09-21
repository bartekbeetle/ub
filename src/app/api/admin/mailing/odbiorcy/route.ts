import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { mailingSegmentSchema, zodErrorMessage } from "@/lib/validators";
import { previewAudience, type MailingSegment } from "@/lib/mailing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Licznik odbiorców dla wybranych filtrów — wołany przy każdej zmianie w UI.
 *
 * Zwraca też `unsubscribed`, czyli ilu ludzi odpadło przez wypisanie. Bez tej liczby
 * admin widzi tylko, że „jest mniej niż myślał", i nie wie dlaczego.
 */
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const parsed = mailingSegmentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }

  const preview = await previewAudience(parsed.data as MailingSegment);

  return NextResponse.json({
    total: preview.total,
    unsubscribed: preview.unsubscribed,
    // Adresy pokazujemy w całości świadomie: to panel admina, ten sam, w którym widać
    // pełne dane leadów. Maskowanie tutaj byłoby teatrem, a utrudniałoby sprawdzenie listy.
    sample: preview.sample.map((r) => ({
      email: r.email,
      name: r.name,
      sourceKind: r.sourceKind,
      category: r.category,
    })),
  });
}
