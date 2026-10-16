import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { automationDef, resolveAutomation, type AutomationKey } from "@/lib/automations";
import { formatDateTime } from "@/lib/utils";
import { MailerTabs } from "@/components/admin/MailerTabs";
import { AutomationEditor } from "@/components/admin/AutomationEditor";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { wyslany: "wysłany", w_kolejce: "w kolejce", blad: "błąd" };

export default async function AutomatPage({ params }: { params: Promise<{ klucz: string }> }) {
  const user = await requireAdmin();
  if (!user) redirect("/admin/login");
  const def = automationDef((await params).klucz);
  if (!def) notFound();
  const current = await resolveAutomation(def.key as AutomationKey);

  const db = await getDb();
  const recent = await db
    .select()
    .from(schema.emailQueue)
    .where(sql`split_part(${schema.emailQueue.kind}, ':', 1) = ${def.key}`)
    .orderBy(desc(schema.emailQueue.createdAt))
    .limit(15);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Mailing</h1>
      <MailerTabs active="automatyzacje" />
      <p className="mt-4 text-sm">
        <Link href="/admin/mailing/automatyzacje" className="font-semibold text-sand-700 hover:underline">← Automatyzacje</Link>
      </p>
      <h2 className="mt-2 font-serif text-xl font-bold">{def.name}</h2>
      <p className="mt-1 text-sm text-muted"><span className="font-semibold text-ink-soft">Kiedy wychodzi:</span> {def.trigger}</p>

      <AutomationEditor
        automationKey={def.key}
        initial={current}
        placeholders={def.placeholders}
        required={def.required ?? []}
        sample={def.sample}
        canReset={!def.settingsFields}
        offWarning={def.offWarning}
        defaultTestTo={user.email}
      />

      <div className="card mt-6 p-6">
        <h3 className="font-serif text-lg font-semibold">Ostatnio wysłane</h3>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Ten automat jeszcze nic nie wysłał.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {recent.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/mailing/wyslane?panel=mail&id=${m.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:bg-sand-50/70">
                  <span className="truncate">{m.toEmail}</span>
                  <span className="text-xs text-muted">
                    {STATUS[m.status] ?? m.status}
                    {m.openedAt ? " · otwarty" : ""}
                    {m.clickedAt ? " · kliknięty" : ""} · {formatDateTime(m.sentAt ?? m.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
