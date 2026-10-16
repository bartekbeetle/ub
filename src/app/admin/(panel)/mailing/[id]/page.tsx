import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { campaignStats } from "@/lib/mailing";
import { isSmtpConfigured } from "@/lib/email";
import { formatDateTime } from "@/lib/utils";
import { MailingRunner } from "@/components/admin/MailingRunner";
import { MailingComposer } from "@/components/admin/MailingComposer";
import { MailerTabs } from "@/components/admin/MailerTabs";
import { campaignTracking, rates } from "@/lib/mailer-stats";

export const dynamic = "force-dynamic";

const RECIPIENT_LABEL: Record<string, string> = {
  oczekuje: "Oczekuje",
  w_kolejce: "W kolejce",
  wyslany: "Wysłany",
  pominiety: "Pominięty",
  blad: "Błąd",
};

export default async function KampaniaPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const db = await getDb();
  const [campaign] = await db
    .select()
    .from(schema.mailingCampaigns)
    .where(eq(schema.mailingCampaigns.id, id))
    .limit(1);
  if (!campaign) notFound();

  const stats = await campaignStats(id);
  const recipients = await db
    .select()
    .from(schema.mailingRecipients)
    .where(eq(schema.mailingRecipients.campaignId, id))
    .orderBy(asc(schema.mailingRecipients.id))
    .limit(200);

  const smtpReady = isSmtpConfigured();
  const tracked = (await campaignTracking()).get(id);
  const tr = tracked ? rates(tracked) : null;

  return (
    <div>
      <MailerTabs active="kampanie" />
      <Link href="/admin/mailing/kampanie" className="mt-4 inline-block text-sm text-muted underline underline-offset-2">
        ← Kampanie
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-bold">{campaign.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Utworzona {formatDateTime(campaign.createdAt)}
        {campaign.createdBy ? ` przez ${campaign.createdBy}` : ""}
      </p>

      {tracked && tracked.sent > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Wysłane", String(tracked.sent)],
            ["Otwarcia", tr?.openRate != null ? `${tr.openRate}% (${tracked.opened})` : "bez śledzenia"],
            ["Kliknięcia", tr?.clickRate != null ? `${tr.clickRate}% (${tracked.clicked})` : "bez śledzenia"],
          ].map(([l, v]) => (
            <div key={l} className="card p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{l}</p>
              <p className="mt-2 font-serif text-2xl font-bold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      )}

      {campaign.status === "szkic" ? (
        <div className="card mt-6 p-6">
          <h2 className="font-serif text-lg font-semibold">Edytuj szkic</h2>
          <p className="mt-1 text-xs text-muted">Treść da się zmieniać do zamrożenia listy odbiorców.</p>
          <MailingComposer
            initial={{ id, name: campaign.name, subject: campaign.subject, body: campaign.body, segment: campaign.segment }}
          />
        </div>
      ) : (
      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Wiadomość</h2>
        <p className="mt-3 font-semibold">{campaign.subject}</p>
        <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-ink">
          {campaign.body}
        </pre>
        <p className="mt-3 text-xs text-muted">
          Do treści doklejamy automatycznie stopkę z powodem otrzymania wiadomości i linkiem
          rezygnacji oraz nagłówki <code className="font-mono">List-Unsubscribe</code>.
        </p>
      </div>
      )}

      <MailingRunner
        campaignId={id}
        status={campaign.status}
        initialStats={stats}
        smtpReady={smtpReady}
        subject={campaign.subject}
        body={campaign.body}
      />

      {recipients.length > 0 && (
        <div className="card mt-6 p-6">
          <h2 className="font-serif text-lg font-semibold">
            Odbiorcy ({stats.total}
            {recipients.length < stats.total ? `, pokazuję ${recipients.length}` : ""})
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-semibold">Adres</th>
                  <th className="pb-2 pr-3 font-semibold">Źródło</th>
                  <th className="pb-2 pr-3 font-semibold">Stan</th>
                  <th className="pb-2 font-semibold">Uwagi</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-3">
                      {r.email}
                      {r.name ? <span className="text-muted"> · {r.name}</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted">
                      {r.sourceKind === "aplikacja" ? "porzucona aplikacja" : "zgłoszenie"}
                    </td>
                    <td className="py-2 pr-3">{RECIPIENT_LABEL[r.status] ?? r.status}</td>
                    <td className="py-2 text-xs text-muted">{r.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
