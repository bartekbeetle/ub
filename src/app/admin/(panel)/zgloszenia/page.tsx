import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SubmissionToggle } from "@/components/admin/SubmissionToggle";
import { RevealContact } from "@/components/admin/RevealContact";
import { formatDateTime, maskEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ZgloszeniaPage() {
  const db = await getDb();
  const submissions = await db.select().from(schema.submissions).orderBy(desc(schema.submissions.createdAt)).limit(300);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Zgłoszenia <span className="text-base font-normal text-muted">({submissions.length})</span></h1>
      <p className="mt-1 text-sm text-muted">Wiadomości z formularzy kontakt i konsultacja.</p>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Typ</th>
              <th className="px-4 py-3 font-semibold">Imię</th>
              <th className="px-4 py-3 font-semibold">Kontakt</th>
              <th className="px-4 py-3 font-semibold">Wiadomość</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {submissions.map((s) => (
              <tr key={s.id} className="align-top hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(s.createdAt)}</td>
                <td className="px-4 py-3"><span className="badge-tag">{s.type}</span></td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div><RevealContact masked={maskEmail(s.email)} full={s.email} /></div>
                    {s.phone && <div className="text-xs text-muted">{s.phone}</div>}
                  </div>
                </td>
                <td className="max-w-md px-4 py-3 text-muted">{s.message ?? "—"}</td>
                <td className="px-4 py-3"><SubmissionToggle id={s.id} isHandled={s.isHandled} /></td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Brak zgłoszeń.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
