import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { sendCampaignBatch, campaignStats } from "@/lib/mailing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/**
 * Wysyła JEDNĄ partię odbiorców. Panel woła w pętli aż do `done: true`.
 *
 * Zdanie, o którym łatwo zapomnieć przy czytaniu odpowiedzi: `sent` to maile przyjęte
 * przez serwer pocztowy, `queued` to takie, które czekają w kolejce (np. bo nie ma
 * konfiguracji SMTP). Suma nie jest „wysłanymi".
 */
export async function POST(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Zła ścieżka." }, { status: 400 });

  const url = new URL(req.url);
  const batch = Math.min(Math.max(Number(url.searchParams.get("batch") || 25), 1), 100);

  try {
    const result = await sendCampaignBatch(id, batch);
    const stats = await campaignStats(id);

    // Log tylko przy pierwszej i ostatniej partii — inaczej dziennik zalewa się wpisami
    // co 25 adresów i przestaje być czytelny przy audycie.
    if (result.done || stats.oczekuje + result.processed === stats.total) {
      await logAudit({
        actor: actorLabel(user),
        action: result.done ? "mailing_wysylka_zakonczona" : "mailing_wysylka_start",
        entityType: "mailing_campaign",
        entityId: id,
        details: { ...stats },
      });
    }

    return NextResponse.json({ ...result, stats });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Nie udało się wysłać partii." },
      { status: 400 }
    );
  }
}
