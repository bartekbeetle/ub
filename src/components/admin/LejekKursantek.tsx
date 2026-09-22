import Link from "next/link";

/**
 * LEJEK KURSANTEK — droga od leada do zapłaty. Tylko ta jedna.
 *
 * 🔴 Decyzja Bartka 22.09.2026: **kafle „Wejście 1 — aplikacja" i „Wejście 2 — konsultacja"
 * usunięte.** Pokazywały, na którym kroku formularza kobieta odpada, i na ile wejść dzielą
 * się leady — czyli przegląd statystyk, a nie rzecz, po której da się coś zrobić. Zaśmiecały
 * podgląd nad tabelą, przez którą realnie się pracuje.
 * Co przejęło ich sygnał: chip **„Porzucone aplikacje"** nad tabelą (z filtrem po kroku
 * porzucenia) i linijka o zgłoszeniach bez kwalifikacji. Filtry `?etap=krok-N`,
 * `?etap=zlozone` i `?etap=inne-wejscia` **nadal działają** z adresu — usunięte są kafle,
 * nie dane. Gdyby kiedyś wróciły: `git show d6db398^:src/components/admin/LejekKursantek.tsx`.
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

function Pasek({ e }: { e: EtapLejka }) {
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
          className="block h-full rounded-full bg-money"
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
  wspolny,
  naStole,
}: {
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

      <div className="card overflow-hidden">
        <div className="border-b bg-money-bg px-3 py-2">
          <h3 className="text-sm font-bold">Od leada do przychodu</h3>
          <p className="text-[11px] text-muted">
            wszystkie wejścia zbiegają się na leadzie · 500 zł naliczamy dopiero przy statusie „zapisana"
          </p>
        </div>
        <div className="divide-y">
          {wspolny.map((e) => (
            <Pasek key={e.klucz} e={e} />
          ))}
        </div>
      </div>
    </section>
  );
}
