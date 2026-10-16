import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Przezroczysty GIF 1×1.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/**
 * Piksel otwarcia (pulpit mailera). Zawsze oddaje obrazek — także dla nieznanego tokenu —
 * żeby klient poczty nie pokazywał zepsutej grafiki. Błąd bazy nie może zepsuć maila.
 * ⚠️ Apple Mail Privacy Protection pobiera piksel sam, więc otwarcia są zawyżone.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (/^[a-f0-9]{32}$/.test(token)) {
    try {
      const db = await getDb();
      await db
        .update(schema.emailQueue)
        .set({
          openCount: sql`${schema.emailQueue.openCount} + 1`,
          openedAt: sql`coalesce(${schema.emailQueue.openedAt}, now())`,
        })
        .where(eq(schema.emailQueue.trackToken, token));
    } catch (err) {
      console.error("[track] open:", err);
    }
  }
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Content-Length": String(PIXEL.length),
    },
  });
}
