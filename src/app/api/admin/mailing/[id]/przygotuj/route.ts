import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { prepareCampaign, campaignStats } from "@/lib/mailing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/** Zamrożenie listy odbiorców („Przygotuj wysyłkę"). Nic jeszcze nie wychodzi. */
export async function POST(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Zła ścieżka." }, { status: 400 });

  try {
    const result = await prepareCampaign(id);
    await logAudit({
      actor: actorLabel(user),
      action: "mailing_lista_zamrozona",
      entityType: "mailing_campaign",
      entityId: id,
      details: { odbiorcy: result.recipients },
    });
    return NextResponse.json({ ...result, stats: await campaignStats(id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Nie udało się przygotować listy." },
      { status: 400 }
    );
  }
}
