import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UstawieniaPage() {
  const settings = await getSettings();
  const db = await getDb();
  const queued = await db
    .select()
    .from(schema.emailQueue)
    .where(eq(schema.emailQueue.status, "w_kolejce"))
    .orderBy(desc(schema.emailQueue.createdAt))
    .limit(20);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Ustawienia</h1>
      <div className="card mt-6 p-6">
        <SettingsForm settings={settings} />
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Kolejka email ({queued.length})</h2>
        <p className="mt-1 text-sm text-muted">
          Maile czekające na wysyłkę — pojawiają się tu, gdy SMTP nie jest skonfigurowane w env (SMTP_HOST/USER/PASS).
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {queued.map((m) => (
            <li key={m.id} className="rounded-lg border border-gray-100 p-3">
              <p className="font-semibold">{m.subject}</p>
              <p className="text-xs text-muted">Do: {m.toEmail} · {formatDateTime(m.createdAt)}{m.leadId ? ` · lead #${m.leadId}` : ""}</p>
            </li>
          ))}
          {queued.length === 0 && <li className="text-muted">Kolejka pusta.</li>}
        </ul>
      </div>
    </div>
  );
}
