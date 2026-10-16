import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AUTOMATIONS, resolveAutomation } from "@/lib/automations";
import { getSettings } from "@/lib/settings";
import { mailerOverview, rates } from "@/lib/mailer-stats";
import { formatDateTime } from "@/lib/utils";
import { MailerTabs } from "@/components/admin/MailerTabs";

export const dynamic = "force-dynamic";

const AUDIENCE: Record<string, string> = { kursantka: "do kursantki", trenerka: "do akademii", akademia: "do akademii" };

/** Lista automatów — jak „Automatyzacje” w MailerLite: wyzwalacz, stan, wyniki z 30 dni. */
export default async function AutomatyzacjePage() {
  if (!(await requireAdmin())) redirect("/admin/login");
  const settings = await getSettings();
  const [resolved, overview] = await Promise.all([
    Promise.all(AUTOMATIONS.map((a) => resolveAutomation(a.key, settings))),
    mailerOverview(30),
  ]);
  const stats = new Map(overview.byKind.map((k) => [k.kind, k]));

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Mailing</h1>
      <MailerTabs active="automatyzacje" />
      <p className="mt-4 max-w-2xl text-sm text-muted">
        Maile, które wychodzą same po zdarzeniu. Kliknij, żeby zobaczyć podgląd, zmienić treść albo wyłączyć.
        Zmiana działa od następnego maila.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {AUTOMATIONS.map((a, i) => {
          const r = resolved[i];
          const s = stats.get(a.key);
          const rt = s ? rates(s) : null;
          return (
            <Link key={a.key} href={`/admin/mailing/automatyzacje/${a.key}`} className="card block p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg font-semibold">{a.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{AUDIENCE[a.audience]}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${
                    r.enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {r.enabled ? "Aktywna" : "Wyłączona"}
                </span>
              </div>
              <p className="mt-3 text-sm"><span className="font-semibold">Kiedy:</span> {a.trigger}</p>
              <p className="mt-1 truncate text-sm text-muted"><span className="font-semibold text-ink-soft">Temat:</span> {r.subject}</p>
              <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-gray-100 pt-3 text-center text-xs">
                <div><dt className="text-muted">Wysłane</dt><dd className="mt-0.5 text-base font-bold tabular-nums">{s?.sent ?? 0}</dd></div>
                <div><dt className="text-muted">Otwarcia</dt><dd className="mt-0.5 text-base font-bold tabular-nums">{rt?.openRate != null ? `${rt.openRate}%` : "—"}</dd></div>
                <div><dt className="text-muted">Kliknięcia</dt><dd className="mt-0.5 text-base font-bold tabular-nums">{rt?.clickRate != null ? `${rt.clickRate}%` : "—"}</dd></div>
                <div><dt className="text-muted">Ostatni</dt><dd className="mt-0.5 font-semibold">{s?.lastAt ? formatDateTime(s.lastAt) : "—"}</dd></div>
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
