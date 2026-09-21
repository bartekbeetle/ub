import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isSmtpConfigured } from "@/lib/email";
import { formatDateTime } from "@/lib/utils";
import { MailingComposer } from "@/components/admin/MailingComposer";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  szkic: "Szkic",
  gotowa: "Lista zamrożona",
  wysylanie: "Wysyłka w toku",
  zakonczona: "Zakończona",
};

export default async function MailingPage() {
  const db = await getDb();
  const campaigns = await db
    .select({
      campaign: schema.mailingCampaigns,
      recipients: sql<number>`count(${schema.mailingRecipients.id})::int`,
    })
    .from(schema.mailingCampaigns)
    .leftJoin(
      schema.mailingRecipients,
      eq(schema.mailingRecipients.campaignId, schema.mailingCampaigns.id)
    )
    .groupBy(schema.mailingCampaigns.id)
    .orderBy(desc(schema.mailingCampaigns.id));

  const smtpReady = isSmtpConfigured();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Mailing</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Propozycje szkoleń wysyłane do kursantek, które zaznaczyły zgodę marketingową.
        Maile transakcyjne (potwierdzenie zgłoszenia, potwierdzenie zapisu) idą osobną
        ścieżką i nie zależą od tej listy.
      </p>

      {!smtpReady && (
        <div className="mt-5 rounded-[12px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Skrzynka nadawcza nie jest skonfigurowana.</strong> Brakuje{" "}
          <code className="font-mono text-xs">SMTP_HOST</code> /{" "}
          <code className="font-mono text-xs">SMTP_USER</code> /{" "}
          <code className="font-mono text-xs">SMTP_PASS</code>. Kampanię można przygotować
          i uruchomić, ale wiadomości <strong>odłożą się w kolejce</strong> zamiast trafić
          do skrzynek — i pójdą dopiero po uzupełnieniu danych logowania.
        </div>
      )}

      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Nowa kampania</h2>
        <MailingComposer />
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Kampanie ({campaigns.length})</h2>
        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nie ma jeszcze żadnej kampanii. Pierwszą utworzysz formularzem powyżej.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-semibold">Nazwa</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Odbiorcy</th>
                  <th className="pb-2 pr-3 font-semibold">Utworzona</th>
                  <th className="pb-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map(({ campaign, recipients }) => (
                  <tr key={campaign.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-semibold">{campaign.name}</p>
                      <p className="text-xs text-muted">{campaign.subject}</p>
                    </td>
                    <td className="py-3 pr-3">{STATUS_LABEL[campaign.status] ?? campaign.status}</td>
                    <td className="py-3 pr-3">{campaign.status === "szkic" ? "—" : recipients}</td>
                    <td className="py-3 pr-3 text-xs text-muted">
                      {formatDateTime(campaign.createdAt)}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/mailing/${campaign.id}`}
                        className="text-sm font-semibold text-navy underline underline-offset-2"
                      >
                        Otwórz
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
