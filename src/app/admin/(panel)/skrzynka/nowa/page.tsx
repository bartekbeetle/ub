import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { inboxConfigured } from "@/lib/inbox";
import { senderContext } from "@/lib/inbox-context";
import { InboxComposer } from "@/components/admin/InboxComposer";
import { SenderContextCard } from "@/components/admin/SenderContextCard";

export const dynamic = "force-dynamic";

/**
 * Nowa wiadomość z `biuro@`. Adresata podajemy przez ID leada/zgłoszenia (`?lead=` / `?zgloszenie=`),
 * a nie przez adres w URL-u — e-mail kursantki nie ląduje w historii przeglądarki ani w logach proxy.
 */
export default async function NowaWiadomoscPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; zgloszenie?: string }>;
}) {
  if (!(await requireAdmin())) redirect("/admin/login");
  if (!inboxConfigured()) redirect("/admin/skrzynka/odebrane");
  const sp = await searchParams;
  const db = await getDb();

  let to = "";
  let name = "";
  const leadId = Number(sp.lead);
  const subId = Number(sp.zgloszenie);
  if (Number.isInteger(leadId) && leadId > 0) {
    const [l] = await db.select({ email: schema.leads.email, name: schema.leads.name }).from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
    if (l) ({ email: to, name } = l);
  } else if (Number.isInteger(subId) && subId > 0) {
    const [s] = await db.select({ email: schema.submissions.email, name: schema.submissions.name }).from(schema.submissions).where(eq(schema.submissions.id, subId)).limit(1);
    if (s) ({ email: to, name } = s);
  }
  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const ctx = to ? await senderContext([to]) : new Map();

  return (
    <div className="max-w-6xl">
      <Link href="/admin/skrzynka/odebrane" className="text-sm font-semibold text-sand-700 hover:underline">
        ← Wróć do skrzynki
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card p-6">
          <h1 className="font-serif text-xl font-bold">Nowa wiadomość</h1>
          <div className="mt-4">
            <InboxComposer
              to={to}
              subject=""
              text={`Dzień dobry${firstName ? ` ${firstName}` : ""},\n\n\n\nPozdrawiamy\nZespół Uniwersytetu Beauty`}
              backHref="/admin/skrzynka/wyslane"
            />
          </div>
        </div>
        {to && <SenderContextCard email={to} ctx={ctx.get(to.toLowerCase())} />}
      </div>
    </div>
  );
}
