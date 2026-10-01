import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getInboxMessage, inboxConfigured, quoteOriginal, replySubject } from "@/lib/inbox";
import { senderContext } from "@/lib/inbox-context";
import { InboxComposer } from "@/components/admin/InboxComposer";
import { SenderContextCard } from "@/components/admin/SenderContextCard";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WiadomoscPage({ params }: { params: Promise<{ folder: string; uid: string }> }) {
  if (!(await requireAdmin())) redirect("/admin/login");
  const { folder, uid: rawUid } = await params;
  const uid = Number(rawUid);
  if ((folder !== "odebrane" && folder !== "wyslane") || !Number.isInteger(uid) || uid <= 0) notFound();
  if (!inboxConfigured()) redirect("/admin/skrzynka/odebrane");

  const msg = await getInboxMessage(folder, uid);
  if (!msg) notFound();
  const ctx = await senderContext([msg.from]);
  const back = `/admin/skrzynka/${folder}`;

  return (
    <div className="max-w-6xl">
      <Link href={back} className="text-sm font-semibold text-sand-700 hover:underline">
        ← Wróć do skrzynki
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="card p-6">
            <h1 className="font-serif text-xl font-bold">{msg.subject}</h1>
            <p className="mt-2 text-sm">
              <span className="text-muted">{folder === "wyslane" ? "Do:" : "Od:"}</span>{" "}
              {msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from}
            </p>
            <p className="text-xs text-muted">{formatDateTime(msg.date)}</p>
            {/* Wyłącznie tekst — patrz nagłówek `@/lib/inbox` (zero HTML z cudzych maili w panelu). */}
            <pre className="mt-5 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{msg.text}</pre>
            {msg.attachments.length > 0 && (
              <p className="mt-4 text-xs text-muted">
                Załączniki ({msg.attachments.length}): {msg.attachments.map((a) => a.filename).join(", ")} — otwórz w poczta.lh.pl.
              </p>
            )}
          </div>

          {folder === "odebrane" && (
            <div className="card p-6">
              <h2 className="font-serif text-lg font-semibold">Odpowiedz</h2>
              <div className="mt-4">
                <InboxComposer
                  to={msg.from}
                  subject={replySubject(msg.subject)}
                  text={`Dzień dobry,\n\n\n\nPozdrawiamy\nZespół Uniwersytetu Beauty${quoteOriginal(msg)}`}
                  replyToUid={msg.uid}
                  backHref={back}
                />
              </div>
            </div>
          )}
        </div>
        <SenderContextCard email={msg.from} ctx={ctx.get(msg.from.toLowerCase())} />
      </div>
    </div>
  );
}
