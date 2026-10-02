import Link from "next/link";
import { getDb } from "@/db";
import { requireSuperadminPage } from "@/lib/auth";
import { listTeam } from "@/lib/team";
import { readAdminAudit } from "@/lib/admin-audit-core";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ZespolLogPage({ searchParams }: { searchParams: Search }) {
  await requireSuperadminPage(); // PRZED jakimkolwiek zapytaniem — dziennik tylko dla superadmina
  const sp = await searchParams;
  const actorParam = typeof sp.konto === "string" && /^\d+$/.test(sp.konto) ? Number(sp.konto) : null;
  const pageParam = typeof sp.strona === "string" && /^\d+$/.test(sp.strona) ? Math.max(1, Number(sp.strona)) : 1;

  const db = await getDb();
  const [team, { rows, total, page, pageSize }] = await Promise.all([
    listTeam(db),
    readAdminAudit(db, { actorUserId: actorParam, page: pageParam }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (actorParam) q.set("konto", String(actorParam));
    if (p > 1) q.set("strona", String(p));
    const s = q.toString();
    return `/admin/zespol/log${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">
          Dziennik zmian <span className="text-base font-normal text-muted">({total})</span>
        </h1>
        <Link href="/admin/zespol" className="btn-outline !px-4 !py-2 !text-sm">← Zespół</Link>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="log-konto">Konto</label>
          <select id="log-konto" name="konto" defaultValue={actorParam ? String(actorParam) : ""} className="input">
            <option value="">Wszystkie</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.email} ({m.role === "superadmin" ? "superadmin" : "admin"})
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-outline !px-4 !py-2 !text-sm">Filtruj</button>
      </form>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Kiedy</th>
              <th className="px-4 py-3 font-semibold">Kto</th>
              <th className="px-4 py-3 font-semibold">Akcja</th>
              <th className="px-4 py-3 font-semibold">Obiekt</th>
              <th className="px-4 py-3 font-semibold">Szczegóły</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ entry, actorEmail }) => (
              <tr key={entry.id} className="align-top hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDateTime(entry.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="text-xs font-semibold">{actorEmail ?? "system"}</p>
                  <p className="text-xs text-muted">{entry.actorRole}</p>
                </td>
                <td className="px-4 py-3 font-semibold">{entry.action}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {entry.entityType}
                  {entry.entityId ? ` #${entry.entityId}` : ""}
                </td>
                <td className="px-4 py-3">
                  {Object.keys(entry.details ?? {}).length > 0 && (
                    <code className="break-all text-xs text-muted">{JSON.stringify(entry.details)}</code>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">Brak wpisów.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Strony dziennika" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={href(page - 1)} className="btn-outline !px-4 !py-2 !text-sm">← Nowsze</Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted">Strona {page} z {pages}</span>
          {page < pages ? (
            <Link href={href(page + 1)} className="btn-outline !px-4 !py-2 !text-sm">Starsze →</Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
