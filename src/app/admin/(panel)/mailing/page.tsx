import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isSmtpConfigured } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { kindLabel, mailerOverview, rates } from "@/lib/mailer-stats";
import { AUTOMATIONS } from "@/lib/automations";
import { formatDateTime } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/ViewMotion";
import { MailerTabs } from "@/components/admin/MailerTabs";
import { TrackingToggle } from "@/components/admin/TrackingToggle";

export const dynamic = "force-dynamic";

const MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];

function pctCell(value: number | null, count: number) {
  return value == null ? "—" : `${value}% (${count})`;
}

/** Pulpit mailera — wzorowany na pulpicie MailerLite: wysyłka, otwarcia, kliknięcia, CTOR, wypisani. */
export default async function MailerPulpitPage() {
  if (!(await requireAdmin())) redirect("/admin/login");
  const [overview, settings] = await Promise.all([mailerOverview(30), getSettings()]);
  const { totals } = overview;
  const r = rates(totals);
  const automationKeys = new Set<string>(AUTOMATIONS.map((a) => a.key));

  const kpis = [
    { label: "Wysłane maile", value: totals.sent, kind: "int" as const, color: "bg-sand-100 text-sand-700", note: "ostatnie 30 dni" },
    { label: "Otwarcia", value: r.openRate ?? 0, kind: "pct" as const, color: "bg-blue-100 text-blue-700", note: r.openRate == null ? "brak maili ze śledzeniem" : `${totals.opened} z ${totals.tracked} śledzonych` },
    { label: "Kliknięcia", value: r.clickRate ?? 0, kind: "pct" as const, color: "bg-purple-100 text-purple-700", note: r.clickRate == null ? "brak maili ze śledzeniem" : `${totals.clicked} osób kliknęło link` },
    { label: "CTOR", value: r.ctor ?? 0, kind: "pct" as const, color: "bg-emerald-100 text-emerald-700", note: "kliknięcia / otwarcia" },
    { label: "Wypisani", value: overview.unsubscribed, kind: "int" as const, color: "bg-amber-100 text-amber-700", note: "z mailingu, ostatnie 30 dni" },
    { label: "Błędy wysyłki", value: totals.failed, kind: "int" as const, color: "bg-red-100 text-red-700", note: `w kolejce czeka: ${overview.queued}` },
  ];

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Mailing</h1>
      <MailerTabs active="pulpit" />

      {!isSmtpConfigured() && (
        <div className="mt-5 rounded-[12px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Wysyłka nie jest skonfigurowana</strong> (brak <code>SMTP_*</code>) — maile czekają w kolejce.
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${k.color}`}>{k.label}</span>
            <p className="mt-3 font-serif text-3xl font-bold text-ink-soft">
              <AnimatedNumber value={k.value} kind={k.kind} />
            </p>
            <p className="mt-1 text-xs text-muted">{k.note}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-6">
        <TrackingToggle enabled={settings.trackingEnabled} />
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Wyniki według rodzaju maila (30 dni)</h2>
        {overview.byKind.length === 0 ? (
          <p className="mt-3 text-sm text-muted">W ostatnich 30 dniach nic nie wyszło.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-semibold">Rodzaj</th>
                  <th className="pb-2 pr-3 font-semibold">Wysłane</th>
                  <th className="pb-2 pr-3 font-semibold">Otwarte</th>
                  <th className="pb-2 pr-3 font-semibold">Kliknięte</th>
                  <th className="pb-2 pr-3 font-semibold">Błędy</th>
                  <th className="pb-2 font-semibold">Ostatni</th>
                </tr>
              </thead>
              <tbody>
                {overview.byKind
                  .sort((a, b) => b.sent - a.sent)
                  .map((k) => {
                    const kr = rates(k);
                    return (
                      <tr key={k.kind} className="border-b border-gray-50 transition-colors duration-150 last:border-0 hover:bg-sand-50/70">
                        <td className="py-3 pr-3 font-semibold">
                          {automationKeys.has(k.kind) ? (
                            <Link href={`/admin/mailing/automatyzacje/${k.kind}`} className="underline-offset-2 hover:underline">
                              {kindLabel(k.kind)}
                            </Link>
                          ) : k.kind === "marketing" ? (
                            <Link href="/admin/mailing/kampanie" className="underline-offset-2 hover:underline">{kindLabel(k.kind)}</Link>
                          ) : (
                            kindLabel(k.kind)
                          )}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">{k.sent}</td>
                        <td className="py-3 pr-3 tabular-nums">{pctCell(kr.openRate, k.opened)}</td>
                        <td className="py-3 pr-3 tabular-nums">{pctCell(kr.clickRate, k.clicked)}</td>
                        <td className="py-3 pr-3 tabular-nums">{k.failed}</td>
                        <td className="py-3 text-xs text-muted">{k.lastAt ? formatDateTime(k.lastAt) : "—"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Wyniki według miesiąca</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 pr-3 font-semibold">Miesiąc</th>
                <th className="pb-2 pr-3 font-semibold">Wysłane</th>
                <th className="pb-2 pr-3 font-semibold">Otwarte</th>
                <th className="pb-2 pr-3 font-semibold">Kliknięte</th>
                <th className="pb-2 font-semibold">Błędy</th>
              </tr>
            </thead>
            <tbody>
              {overview.monthly.map((m) => {
                const mr = rates(m);
                const [y, mo] = m.month.split("-").map(Number);
                return (
                  <tr key={m.month} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 pr-3">{y} {MONTHS[mo - 1]}</td>
                    <td className="py-3 pr-3 tabular-nums">{m.sent}</td>
                    <td className="py-3 pr-3 tabular-nums">{pctCell(mr.openRate, m.opened)}</td>
                    <td className="py-3 pr-3 tabular-nums">{pctCell(mr.clickRate, m.clicked)}</td>
                    <td className="py-3 tabular-nums">{m.failed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted">
          Otwarcia liczymy tylko z maili wysłanych ze śledzeniem. Apple Mail sam pobiera obrazki, więc część
          „otwarć” to automat — kliknięcia są pewniejszym sygnałem.
        </p>
      </div>
    </div>
  );
}
