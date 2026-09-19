import type { Metadata } from "next";
import Link from "next/link";
import { getSuppressionByToken } from "@/lib/marketing-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rezygnacja z propozycji szkoleń — Uniwersytet Beauty",
  // Strona jest osobista i dostępna tylko z linku w mailu — nie ma czego indeksować.
  robots: { index: false, follow: false },
};

type Params = Promise<{ token: string }>;
type Search = Promise<{ ok?: string }>;

/**
 * Rezygnacja z propozycji szkoleń.
 *
 * 🔴 Dlaczego jest tu PRZYCISK, a nie wypisanie od razu po wejściu:
 * filtry antyspamowe i podglądy linków (Outlook, skanery bezpieczeństwa) **same otwierają
 * adresy z wiadomości**. Gdyby samo wejście wypisywało, kursantki znikałyby z listy,
 * nigdy nie klikając — i nikt by nie wiedział dlaczego. Wypisanie robi dopiero POST,
 * którego żaden skaner nie wyśle.
 *
 * Formularz działa BEZ JavaScriptu — klient pocztowy bywa prymitywny, a rezygnacja
 * musi działać zawsze. To nie jest miejsce na elegancję kosztem niezawodności.
 */
export default async function WypiszPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { token } = await params;
  const { ok } = await searchParams;
  const row = await getSuppressionByToken(token);

  const done = ok === "1" || Boolean(row?.optOutAt);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="card p-8">
        {!row ? (
          <>
            <h1 className="text-2xl font-bold text-ink">Nie rozpoznajemy tego odnośnika</h1>
            <p className="mt-4 text-slate-700">
              Link mógł zostać skrócony albo przepisany niekompletnie. Napisz na{" "}
              <a className="underline" href="mailto:biuro@uniwersytetbeauty.pl">
                biuro@uniwersytetbeauty.pl
              </a>{" "}
              — wypiszemy Cię ręcznie.
            </p>
          </>
        ) : done ? (
          <>
            <h1 className="text-2xl font-bold text-ink">Gotowe — nie wyślemy już propozycji szkoleń</h1>
            <p className="mt-4 text-slate-700">
              Adres <strong>{row.email}</strong> został wypisany z naszej listy mailingowej.
            </p>
            <p className="mt-3 text-slate-700">
              Nadal możesz dostać od nas wiadomość w sprawie zgłoszenia, które już złożyłaś —
              na przykład potwierdzenie zapisu na szkolenie. To nie jest mailing, tylko obsługa
              Twojej sprawy.
            </p>
            <p className="mt-6 text-sm text-slate-600">
              Kliknęłaś przez pomyłkę albo chcesz wrócić na listę? Napisz na{" "}
              <a className="underline" href="mailto:biuro@uniwersytetbeauty.pl">
                biuro@uniwersytetbeauty.pl
              </a>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink">Nie chcesz dostawać propozycji szkoleń?</h1>
            <p className="mt-4 text-slate-700">
              Potwierdź, a wypiszemy adres <strong>{row.email}</strong> z listy mailingowej.
            </p>
            <form action="/api/wypisz" method="POST" className="mt-6">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn-primary">
                Tak, nie chcę więcej propozycji szkoleń
              </button>
            </form>
            <p className="mt-6 text-sm text-slate-600">
              Wiadomości dotyczące zgłoszenia, które już złożyłaś (np. potwierdzenie zapisu),
              będziemy wysyłać nadal — to obsługa Twojej sprawy, nie mailing.
            </p>
          </>
        )}

        <p className="mt-8 border-t border-slate-200 pt-6 text-sm">
          <Link href="/" className="underline">
            Wróć na stronę główną
          </Link>
        </p>
      </div>
    </main>
  );
}
