import Link from "next/link";

/**
 * LEJEK KURSANTEK — jeden ekran od „zaczęła wypełniać" do „zapłacone".
 *
 * 🔴 Dlaczego to NIE jest jeden słupek od góry do dołu:
 * do leada prowadzą DWIE różne drogi i one nie mają wspólnej historii.
 *  — Aplikacja (`/aplikacja`): 7 kroków, każdy zapisywany w `quiz_sessions`, więc widać,
 *    na którym pytaniu kobieta odpada.
 *  — Konsultacja i kontakt: jeden formularz, zero kroków pośrednich.
 * Gdyby wrzucić je w jeden słupek, leady z konsultacji wyglądałyby na takie, które
 * „przeszły" kroki aplikacji, których nigdy nie widziały — a procenty odpadania
 * stałyby się fikcją. Dlatego dwie ścieżki wejścia zbiegają się dopiero na „Lead".
 *
 * Liczby dotyczą CAŁEJ BAZY, nie przefiltrowanej tabeli niżej — inaczej kafelek
 * i lista pod nim pokazywałyby różne wartości i wyglądało to na błąd.
 */

export type EtapLejka = {
  /** Wartość `?etap=` — kliknięcie filtruje tabelę pod lejkiem. */
  klucz: string;
  etykieta: string;
  liczba: number;
  /** Szerokość paska: % względem początku TEJ ścieżki. */
  procent: number;
  /** Ile odpadło między poprzednim etapem a tym. */
  ubytek?: number;
  /** Kwota w zł przypisana do etapu (zapisana / rozliczona). */
  kwota?: number;
  opis?: string;
  alarm?: boolean;
};

function Pasek({ e, ton }: { e: EtapLejka; ton: "aplikacja" | "inne" | "wspolny" }) {
  const kolor =
    ton === "wspolny" ? "bg-money" : ton === "aplikacja" ? "bg-sand-700" : "bg-sand-400";

  return (
    <Link
      href={`/admin/kursantki?etap=${e.klucz}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-sand-50"
    >
      <span className="w-52 shrink-0 text-sm">
        {e.etykieta}
        {e.opis && <span className="block text-[11px] text-muted">{e.opis}</span>}
      </span>

      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand-100">
        <span
          className={`block h-full rounded-full ${kolor}`}
          style={{ width: `${Math.max(e.procent, e.liczba > 0 ? 2 : 0)}%` }}
        />
      </span>

      <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums">{e.liczba}</span>

      <span className="w-24 shrink-0 text-right text-xs tabular-nums">
        {e.kwota ? (
          <span className="font-semibold text-money-dark">{e.kwota.toLocaleString("pl-PL")} zł</span>
        ) : e.ubytek && e.ubytek > 0 ? (
          <span className={e.alarm ? "font-semibold text-red-700" : "text-muted"}>−{e.ubytek}</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </span>
    </Link>
  );
}

export function LejekKursantek({
  aplikacja,
  inneWejscia,
  wspolny,
  naStole,
}: {
  aplikacja: EtapLejka[];
  inneWejscia: EtapLejka[];
  wspolny: EtapLejka[];
  /** Leady bez trenerki × stawka — pieniądz leżący bez adresata. */
  naStole: { leadow: number; kwota: number };
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg font-bold">Lejek — od pierwszego kliknięcia do zapłaty</h2>
        <p className="text-xs text-muted">liczby z całej bazy · tabela niżej filtruje się po kliknięciu w etap</p>
      </div>

      {naStole.leadow > 0 && (
        <div className="rounded-xl border border-money/30 bg-money-bg px-4 py-3">
          <p className="text-sm">
            <strong className="text-money-dark">{naStole.kwota.toLocaleString("pl-PL")} zł</strong> leży
            bez adresata — <strong>{naStole.leadow}</strong>{" "}
            {naStole.leadow === 1 ? "lead nie ma" : "leadów nie ma"} przypisanej trenerki.{" "}
            <Link href="/admin/kursantki?etap=bez-przydzialu" className="font-semibold underline">
              Pokaż
            </Link>
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b bg-sand-50 px-3 py-2">
            <h3 className="text-sm font-bold">Wejście 1 — aplikacja</h3>
            <p className="text-[11px] text-muted">7 kroków formularza; widać, które pytanie zabija konwersję</p>
          </div>
          <div className="divide-y">
            {aplikacja.map((e) => (
              <Pasek key={e.klucz} e={e} ton="aplikacja" />
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b bg-sand-50 px-3 py-2">
            <h3 className="text-sm font-bold">Wejście 2 — konsultacja i kontakt</h3>
            <p className="text-[11px] text-muted">jeden formularz, bez kroków pośrednich — nie ma tu czego mierzyć</p>
          </div>
          <div className="divide-y">
            {inneWejscia.map((e) => (
              <Pasek key={e.klucz} e={e} ton="inne" />
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b bg-money-bg px-3 py-2">
          <h3 className="text-sm font-bold">Wspólna droga — tu powstaje przychód</h3>
          <p className="text-[11px] text-muted">
            obie ścieżki zbiegają się na leadzie · 500 zł naliczamy dopiero przy statusie „zapisana"
          </p>
        </div>
        <div className="divide-y">
          {wspolny.map((e) => (
            <Pasek key={e.klucz} e={e} ton="wspolny" />
          ))}
        </div>
      </div>
    </section>
  );
}
