import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { KIND_LABELS, kindLabel } from "@/lib/mailer-stats";
import { formatDateTime } from "@/lib/utils";
import { MailerTabs } from "@/components/admin/MailerTabs";
import { PanelLink, PanelRow, UrlDrawer } from "@/components/ui/Drawer";
import { SkeletonCard } from "@/components/ui/Skeleton";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  wyslany: { label: "wysłany", cls: "bg-emerald-100 text-emerald-700" },
  w_kolejce: { label: "w kolejce", cls: "bg-amber-100 text-amber-800" },
  blad: { label: "błąd", cls: "bg-red-100 text-red-700" },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

/** Dziennik wysłanych maili — każdy mail z aplikacji, z podglądem treści i wynikiem (otwarty/kliknięty). */
export default async function WyslanePage({ searchParams }: { searchParams: SP }) {
  if (!(await requireAdmin())) redirect("/admin/login");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const rodzaj = str("rodzaj");
  const status = str("status");
  const panelId = str("panel") === "mail" && /^\d+$/.test(str("id")) ? str("id") : null;

  const where: SQL[] = [];
  if (rodzaj) where.push(sql`split_part(${schema.emailQueue.kind}, ':', 1) = ${rodzaj}`);
  if (status === "wyslany" || status === "w_kolejce" || status === "blad") where.push(eq(schema.emailQueue.status, status));

  const db = await getDb();
  const rows = await db
    .select({
      id: schema.emailQueue.id,
      toEmail: schema.emailQueue.toEmail,
      subject: schema.emailQueue.subject,
      kind: schema.emailQueue.kind,
      status: schema.emailQueue.status,
      createdAt: schema.emailQueue.createdAt,
      sentAt: schema.emailQueue.sentAt,
      openedAt: schema.emailQueue.openedAt,
      clickedAt: schema.emailQueue.clickedAt,
    })
    .from(schema.emailQueue)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.emailQueue.createdAt))
    .limit(100);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Mailing</h1>
      <MailerTabs active="wyslane" />

      <form className="mt-5 flex flex-wrap items-end gap-3" action="/admin/mailing/wyslane">
        <div>
          <label className="label" htmlFor="w-rodzaj">Rodzaj</label>
          <select id="w-rodzaj" name="rodzaj" defaultValue={rodzaj} className="input !py-2 text-sm">
            <option value="">Wszystkie</option>
            {Object.entries(KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="w-status">Status</label>
          <select id="w-status" name="status" defaultValue={status} className="input !py-2 text-sm">
            <option value="">Wszystkie</option>
            <option value="wyslany">Wysłane</option>
            <option value="w_kolejce">W kolejce</option>
            <option value="blad">Błędy</option>
          </select>
        </div>
        <button className="press btn-primary !px-5 !py-2 !text-sm">Filtruj</button>
        {(rodzaj || status) && (
          <Link href="/admin/mailing/wyslane" className="pb-2 text-sm font-semibold text-sand-700 hover:underline">Wyczyść</Link>
        )}
      </form>

      <div className="card mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Do</th>
              <th className="px-3 py-3 font-semibold">Temat</th>
              <th className="px-3 py-3 font-semibold">Rodzaj</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Wynik</th>
              <th className="px-5 py-3 font-semibold">Kiedy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <PanelRow key={m.id} name="mail" id={m.id} className="border-b border-gray-50 last:border-0 hover:bg-sand-50/70">
                <td className="px-5 py-3">
                  <PanelLink name="mail" id={m.id} className="font-semibold hover:underline">{m.toEmail}</PanelLink>
                </td>
                <td className="max-w-[280px] truncate px-3 py-3">{m.subject}</td>
                <td className="px-3 py-3 text-xs text-muted">{kindLabel(m.kind)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${STATUS[m.status]?.cls ?? ""}`}>
                    {STATUS[m.status]?.label ?? m.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs">{m.clickedAt ? "kliknięty" : m.openedAt ? "otwarty" : "—"}</td>
                <td className="px-5 py-3 text-xs text-muted">{formatDateTime(m.sentAt ?? m.createdAt)}</td>
              </PanelRow>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-sm text-muted">Brak maili dla tych filtrów.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length === 100 && <p className="mt-2 text-xs text-muted">Pokazuję 100 najnowszych. Zawęź filtrem, żeby zobaczyć starsze.</p>}

      <UrlDrawer name="mail" contentId={panelId} title="Wiadomość" fallback={<SkeletonCard rows={6} />}>
        {panelId && (
          <Suspense key={panelId} fallback={<SkeletonCard rows={6} />}>
            <MailPreview id={Number(panelId)} />
          </Suspense>
        )}
      </UrlDrawer>
    </div>
  );
}

async function MailPreview({ id }: { id: number }) {
  const db = await getDb();
  const [m] = await db.select().from(schema.emailQueue).where(eq(schema.emailQueue.id, id)).limit(1);
  if (!m) return <p className="text-sm text-muted">Nie ma takiej wiadomości.</p>;
  const st = STATUS[m.status];
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">Do</dt><dd className="break-all font-semibold">{m.toEmail}</dd>
        <dt className="text-muted">Temat</dt><dd className="font-semibold">{m.subject}</dd>
        <dt className="text-muted">Rodzaj</dt><dd>{kindLabel(m.kind)}</dd>
        <dt className="text-muted">Status</dt>
        <dd><span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${st?.cls ?? ""}`}>{st?.label ?? m.status}</span>{m.attempts > 1 ? <span className="ml-2 text-xs text-muted">prób: {m.attempts}</span> : null}</dd>
        <dt className="text-muted">Utworzony</dt><dd>{formatDateTime(m.createdAt)}</dd>
        <dt className="text-muted">Wysłany</dt><dd>{m.sentAt ? formatDateTime(m.sentAt) : "—"}</dd>
        <dt className="text-muted">Otwarcia</dt><dd>{m.trackToken ? (m.openedAt ? `${m.openCount}× (pierwsze ${formatDateTime(m.openedAt)})` : "nie otwarty") : "bez śledzenia"}</dd>
        <dt className="text-muted">Kliknięcia</dt><dd>{m.trackToken ? (m.clickedAt ? `${m.clickCount}× (pierwsze ${formatDateTime(m.clickedAt)})` : "brak") : "bez śledzenia"}</dd>
        {m.replyTo && (<><dt className="text-muted">Odpowiedzi do</dt><dd>{m.replyTo}</dd></>)}
        {m.leadId && (<><dt className="text-muted">Kursantka</dt><dd><Link href={`/admin/kursantki?panel=kursantka&id=${m.leadId}`} className="font-semibold text-sand-700 hover:underline">lead #{m.leadId} →</Link></dd></>)}
      </dl>
      {m.error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <strong>Błąd serwera pocztowego:</strong> <code className="break-all">{m.error}</code>
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white">
        <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Treść</p>
        <div className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed">{m.body}</div>
      </div>
    </div>
  );
}
