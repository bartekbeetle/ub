import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { telefonEnabled } from "@/lib/telefon/flag";
import { smsgateConfigured } from "@/lib/telefon/smsgate";
import { getThread, listThreads, markThreadRead } from "@/lib/telefon/core";
import { formatPhone, normalizeAnyPhone } from "@/lib/telefon/phone";
import { formatDateTime } from "@/lib/utils";
import { TelefonActions } from "@/components/admin/TelefonActions";
import { TelefonNowyNumer } from "@/components/admin/TelefonNowyNumer";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  odebrany: "odebrany",
  wyslany: "wysłany z telefonu",
  dostarczony: "dostarczony",
  blad: "nie wysłano",
  "dry-run": "tryb testowy — NIE wysłano",
};
const OUTCOME: Record<string, string> = { odebrala: "Odebrała", nieodebrala: "Nie odebrała", oddzwonic: "Oddzwonić" };

/**
 * Telefon UB w panelu: wątki SMS z numerem UB (karta SIM w dedykowanym telefonie, aplikacja
 * SMS Gateway), przycisk Zadzwoń (`tel:` — dzwoni sam telefon, więc rozmówca widzi numer UB)
 * i dziennik wyników rozmów. Za flagą `TELEFON_ENABLED`.
 */
export default async function TelefonPage({ searchParams }: { searchParams: Promise<{ numer?: string }> }) {
  if (!telefonEnabled()) notFound();
  if (!(await requireAdmin())) redirect("/admin/login");

  const sp = await searchParams;
  const active = normalizeAnyPhone(sp.numer);
  const live = smsgateConfigured();
  const [threads, thread] = await Promise.all([listThreads(), active ? getThread(active) : null]);
  if (active) await markThreadRead(active);

  const timeline = thread
    ? [
        ...thread.messages.map((m) => ({ kind: "sms" as const, at: m.createdAt, m })),
        ...thread.calls.map((c) => ({ kind: "call" as const, at: c.createdAt, c })),
      ].sort((a, b) => a.at.getTime() - b.at.getTime())
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Telefon UB</h1>
        <p className="mt-1 text-sm text-sand-500">SMS-y i rozmowy z numeru telefonu Uniwersytetu Beauty.</p>
      </div>

      {!live && (
        <div role="status" className="rounded-[12px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Tryb testowy.</strong> Telefon nie jest jeszcze połączony z panelem — wiadomości zapisują się tutaj, ale
          nic nie wychodzi i nic nie przychodzi.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <TelefonNowyNumer />
          {threads.length === 0 ? (
            <p className="text-sm text-sand-500">Brak rozmów. Wpisz numer powyżej.</p>
          ) : (
            <ul className="divide-y divide-sand-200 rounded-[12px] border border-sand-200 bg-white">
              {threads.map((t) => (
                <li key={t.phone}>
                  <Link
                    href={`/admin/telefon?numer=${encodeURIComponent(t.phone)}`}
                    className={`block px-4 py-3 hover:bg-sand-50 ${t.phone === active ? "bg-sand-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{t.label ?? formatPhone(t.phone)}</span>
                      {t.unread > 0 && (
                        <span className="rounded-full bg-money px-2 py-0.5 text-xs font-bold text-white">{t.unread}</span>
                      )}
                    </div>
                    {t.label && <div className="text-xs text-sand-500">{formatPhone(t.phone)}</div>}
                    <p className="mt-1 truncate text-xs text-sand-500">
                      {t.lastDirection === "out" ? "Ty: " : ""}
                      {t.lastBody}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section>
          {!active || !thread ? (
            <p className="text-sm text-sand-500">Wybierz rozmowę z listy albo wpisz nowy numer.</p>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-bold">{thread.label ?? formatPhone(active)}</h2>
                  {thread.label && <p className="text-sm text-sand-500">{formatPhone(active)}</p>}
                </div>
                {timeline.length === 0 && <p className="text-sm text-sand-500">Jeszcze nic z tym numerem.</p>}
                <ol className="space-y-2">
                  {timeline.map((item) =>
                    item.kind === "sms" ? (
                      <li key={`m${item.m.id}`} className={`flex ${item.m.direction === "out" ? "justify-end" : ""}`}>
                        <div
                          className={`max-w-[85%] rounded-[12px] px-3 py-2 text-sm ${
                            item.m.direction === "out" ? "bg-money/10" : "bg-sand-100"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{item.m.body}</p>
                          <p className="mt-1 text-xs text-sand-500">
                            {formatDateTime(item.m.createdAt)} · {STATUS[item.m.status] ?? item.m.status}
                            {item.m.error ? ` — ${item.m.error}` : ""}
                          </p>
                        </div>
                      </li>
                    ) : (
                      <li key={`c${item.c.id}`} className="text-center text-xs text-sand-500">
                        📞 Rozmowa: <strong>{OUTCOME[item.c.outcome] ?? item.c.outcome}</strong> · {formatDateTime(item.c.createdAt)}
                        {item.c.note ? ` — ${item.c.note}` : ""}
                      </li>
                    ),
                  )}
                </ol>
              </div>
              <TelefonActions phone={active} e164={active} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
