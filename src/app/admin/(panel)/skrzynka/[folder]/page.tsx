import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { inboxAddress, inboxConfigured, listInbox, type InboxFolder, type InboxListItem } from "@/lib/inbox";
import { senderContext } from "@/lib/inbox-context";
import { formatDateTime } from "@/lib/utils";
import { LEAD_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const FOLDERS: { key: InboxFolder; label: string }[] = [
  { key: "odebrane", label: "Odebrane" },
  { key: "wyslane", label: "Wysłane" },
];

export default async function SkrzynkaPage({ params }: { params: Promise<{ folder: string }> }) {
  // Strażnik w samej stronie, nie tylko w layoucie — patrz komentarz w layoucie panelu.
  if (!(await requireAdmin())) redirect("/admin/login");
  const { folder } = await params;
  if (folder !== "odebrane" && folder !== "wyslane") notFound();

  if (!inboxConfigured()) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-serif text-2xl font-bold">Skrzynka</h1>
        <div className="card mt-6 border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Skrzynka nie jest podpięta.</strong> W zmiennych środowiskowych brakuje{" "}
          <code>INBOX_USER</code> i <code>INBOX_PASS</code> (konto <code>biuro@uniwersytetbeauty.pl</code> w LH).
          Po ich ustawieniu aplikacja wymaga restartu w Coolify.
        </div>
      </div>
    );
  }

  let items: InboxListItem[] = [];
  let error: string | null = null;
  try {
    items = await listInbox(folder);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const ctx = await senderContext(items.map((i) => i.from));
  const unread = folder === "odebrane" ? items.filter((i) => !i.seen).length : 0;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Skrzynka</h1>
          <p className="mt-1 text-sm text-muted">
            {inboxAddress()} — tu trafiają odpowiedzi kursantek na maile automatyczne (Reply-To) i wycofania zgód.
          </p>
        </div>
        <Link href="/admin/skrzynka/nowa" className="btn-primary !px-5 !py-2 !text-sm">Napisz</Link>
      </div>

      <div className="mt-5 flex gap-2">
        {FOLDERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/skrzynka/${f.key}`}
            aria-current={f.key === folder ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              f.key === folder ? "bg-sand-400 text-ink-soft" : "bg-sand-100 text-sand-700 hover:bg-sand-200"
            }`}
          >
            {f.label}
            {f.key === "odebrane" && unread > 0 ? ` (${unread} nowe)` : ""}
          </Link>
        ))}
      </div>

      {error && (
        <div role="alert" className="card mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Nie udało się połączyć ze skrzynką: <code>{error}</code>
        </div>
      )}

      <ul className="card mt-6 divide-y divide-gray-100">
        {items.map((m) => {
          const c = ctx.get(m.from.toLowerCase());
          const lead = c?.leads[0];
          return (
            <li key={m.uid}>
              <Link
                href={`/admin/skrzynka/${folder}/${m.uid}`}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 hover:bg-sand-50"
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${m.seen || folder === "wyslane" ? "" : "font-bold"}`}>
                    {folder === "wyslane" ? "Do: " : ""}
                    {m.fromName ? `${m.fromName} <${m.from}>` : m.from}
                  </p>
                  <p className={`truncate text-sm ${m.seen || folder === "wyslane" ? "text-muted" : "font-semibold"}`}>
                    {m.subject}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  {lead && (
                    <span className="badge-tag">
                      Lead #{lead.id} · {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                    </span>
                  )}
                  {m.answered && <span className="badge-money">odpisane</span>}
                  <span>{formatDateTime(m.date)}</span>
                </div>
              </Link>
            </li>
          );
        })}
        {!error && items.length === 0 && <li className="px-5 py-6 text-sm text-muted">Pusto.</li>}
      </ul>
      <p className="mt-2 text-xs text-muted">Ostatnie 50 wiadomości. Otwarcie maila tutaj nie oznacza go jako przeczytanego.</p>
    </div>
  );
}
