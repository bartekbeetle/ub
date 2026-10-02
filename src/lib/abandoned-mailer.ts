import "server-only";
import { getDb } from "@/db";
import { EMAIL_KIND, sendOrQueueEmail } from "@/lib/email";
import { getOrCreateUnsubscribeToken } from "@/lib/marketing-list";
import { runAbandonedMailerCore, type RunResult } from "@/lib/abandoned-core";

/**
 * Przypomnienie „dokończ aplikację" — wiring na prawdziwą bazę i prawdziwą kolejkę maili.
 * Logika (okno, dedup, wykluczenia, treść) mieszka w `abandoned-core.ts` i jest testowana
 * na PGlite. Mail idzie przez `emailQueue`, więc bez SMTP po prostu czeka w kolejce.
 */
export async function runAbandonedMailer(): Promise<RunResult> {
  const db = await getDb();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uniwersytetbeauty.pl";
  return runAbandonedMailerCore(db, {
    siteUrl,
    unsubscribeToken: getOrCreateUnsubscribeToken,
    enqueue: async (m) => {
      const res = await sendOrQueueEmail({
        to: m.to,
        subject: m.subject,
        body: m.body,
        kind: EMAIL_KIND.PORZUCONA_APLIKACJA,
        headers: m.headers,
        // Dedup po leadzie nie ma tu sensu (lead nie istnieje); gwarancją jest UNIQUE na adresie.
        dedupe: false,
      });
      return { queueId: res.queueId };
    },
  });
}
