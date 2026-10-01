import Link from "next/link";
import type { SenderContext } from "@/lib/inbox-context";
import { formatDateTime } from "@/lib/utils";
import { LEAD_STATUS_LABELS, SUBMISSION_TYPE_LABELS, voivodeshipName } from "@/lib/constants";

const EMAIL_STATUS: Record<string, string> = {
  w_kolejce: "czeka w kolejce (nie wyszedł)",
  wyslany: "wysłany",
  blad: "błąd wysyłki",
};

/** Co wiemy o adresie z bazy: leady, zgłoszenia, maile, które do niego (nie) wyszły. */
export function SenderContextCard({ email, ctx }: { email: string; ctx: SenderContext | undefined }) {
  const empty = !ctx || (!ctx.leads.length && !ctx.submissions.length && !ctx.emails.length);
  return (
    <div className="card p-5">
      <h2 className="font-serif text-lg font-semibold">W naszej bazie</h2>
      <p className="mt-1 break-all text-xs text-muted">{email}</p>
      {empty ? (
        <p className="mt-3 text-sm text-muted">Ten adres nie występuje w leadach ani zgłoszeniach.</p>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          {ctx!.leads.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Leady</p>
              <ul className="mt-1 space-y-1">
                {ctx!.leads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/kursantki/${l.id}`} className="link-inline">#{l.id} {l.name}</Link>
                    <span className="text-muted"> · {l.category} · {voivodeshipName(l.voivodeship)} · {LEAD_STATUS_LABELS[l.status] ?? l.status} · {formatDateTime(l.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ctx!.submissions.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Zgłoszenia</p>
              <ul className="mt-1 space-y-1">
                {ctx!.submissions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/kursantki/zgloszenie/${s.id}`} className="link-inline">#{s.id} {SUBMISSION_TYPE_LABELS[s.type] ?? s.type}</Link>
                    <span className="text-muted"> · {formatDateTime(s.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ctx!.emails.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Maile automatyczne do niej</p>
              <ul className="mt-1 space-y-1">
                {ctx!.emails.map((e) => (
                  <li key={e.id}>
                    {e.subject}
                    <span className={e.status === "wyslany" ? "text-money-dark" : "text-red-700"}>
                      {" "}· {EMAIL_STATUS[e.status] ?? e.status}
                    </span>
                    <span className="text-muted"> · {formatDateTime(e.sentAt ?? e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
