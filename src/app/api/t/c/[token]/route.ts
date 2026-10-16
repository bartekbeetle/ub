import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { urlInBody } from "@/lib/email-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK = process.env.NEXT_PUBLIC_SITE_URL || "https://uniwersytetbeauty.pl";

/**
 * Kliknięcie w link z maila: liczymy i przekierowujemy.
 * Przekierowujemy WYŁĄCZNIE na adres, który jest w treści tego maila — inaczej każdy mógłby
 * zbudować link `uniwersytetbeauty.pl/api/t/c/…?u=<phishing>` z naszą domeną na początku.
 * Klik liczy się też jako otwarcie (piksel bywa blokowany, a klik bez otwarcia nie istnieje).
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = new URL(req.url).searchParams.get("u") ?? "";
  if (!/^[a-f0-9]{32}$/.test(token)) return NextResponse.redirect(FALLBACK, 302);

  try {
    const db = await getDb();
    const [row] = await db
      .select({ id: schema.emailQueue.id, body: schema.emailQueue.body })
      .from(schema.emailQueue)
      .where(eq(schema.emailQueue.trackToken, token))
      .limit(1);
    if (!row || !urlInBody(target, row.body)) return NextResponse.redirect(FALLBACK, 302);

    await db
      .update(schema.emailQueue)
      .set({
        clickCount: sql`${schema.emailQueue.clickCount} + 1`,
        clickedAt: sql`coalesce(${schema.emailQueue.clickedAt}, now())`,
        openedAt: sql`coalesce(${schema.emailQueue.openedAt}, now())`,
      })
      .where(eq(schema.emailQueue.id, row.id));
    return NextResponse.redirect(target, 302);
  } catch (err) {
    console.error("[track] click:", err);
    // Awaria bazy nie może zgubić kliknięcia człowieka — jeśli adres wygląda na nasz, puszczamy dalej.
    return NextResponse.redirect(target.startsWith(FALLBACK) ? target : FALLBACK, 302);
  }
}
