import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PoradnikForm } from "@/components/PoradnikForm";
import { IconCheck } from "@/components/icons";
import { SITE_NAME, SUBSIDY_RANGE, SUBSIDY_CONDITION } from "@/lib/constants";

const TYTUL = "Bezpłatny poradnik: jak zacząć w beauty i sprawdzić swoje dofinansowanie";
const OPIS =
  "Ekspercki poradnik dla kobiet, które myślą o pierwszym kursie beauty: jak naprawdę wygląda szkolenie, jak wejść do branży i na czym polegają dofinansowania z BUR. Osobne wydania dla śląskiego i wielkopolskiego.";

export const metadata: Metadata = {
  title: { absolute: TYTUL },
  description: OPIS,
  alternates: { canonical: "/poradnik" },
  openGraph: {
    title: TYTUL,
    description: OPIS,
    url: "/poradnik",
    type: "website",
    locale: "pl_PL",
    siteName: SITE_NAME,
  },
};

/** Co jest w środku — konkrety z realnej treści poradnika, nie ogólniki. */
const W_SRODKU = [
  "Ile naprawdę trwa kurs i jak wygląda dzień szkoleniowy, godzina po godzinie",
  "Skąd biorą się modelki i co zrobić, gdy akademia ich nie zapewnia",
  "Co oznacza certyfikat w zawodzie nieregulowanym i kiedy jest coś wart",
  "Od której kategorii zacząć i jakie są pierwsze kroki po kursie",
  "Kto może dostać dofinansowanie z BUR — i dlaczego nie trzeba być bezrobotną",
  "Ścieżka do dofinansowania w ośmiu krokach, z listą dokumentów",
  "Progi i limity kwotowe obowiązujące w Twoim województwie",
  "Dziesięć pytań, które warto zadać akademii, zanim się zapiszesz",
];

export default function PoradnikPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <Breadcrumbs
        items={[
          { name: "Strona główna", url: "/" },
          { name: "Poradnik", url: "/poradnik" },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_460px] lg:gap-16">
        {/* TREŚĆ */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-sand-700">
            Poradnik do pobrania
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight md:text-4xl">
            Jak zacząć w branży beauty i sprawdzić, czy przysługuje Ci dofinansowanie
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Trzydzieści stron konkretów zamiast obietnic. Jak wygląda szkolenie od środka,
            jak wejść do zawodu i jak działa dofinansowanie z Bazy Usług Rozwojowych.
          </p>

          {/* 🔴 Kluczowe rozróżnienie wobec konkurencji: to są środki publiczne z rejestru,
              a nie rabat handlowy sprzedawcy kursów. Klientka ma to móc SPRAWDZIĆ sama. */}
          <div className="mt-6 rounded-[12px] border border-sand-200 bg-sand-50 p-5">
            <p className="text-sm leading-relaxed text-ink">
              <strong>To nie jest rabat sprzedawcy kursów.</strong> Dofinansowanie z BUR pochodzi
              z funduszy europejskich rozdzielanych przez operatorów regionalnych, a każdą
              akademię i każdą usługę możesz sprawdzić w publicznym rejestrze PARP:{" "}
              <a
                href="https://uslugirozwojowe.parp.gov.pl"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-sand-700"
              >
                uslugirozwojowe.parp.gov.pl
              </a>
              .
            </p>
          </div>

          <h2 className="mt-10 text-xl font-bold">Co znajdziesz w środku</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {W_SRODKU.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <IconCheck width={18} height={18} className="mt-0.5 shrink-0 text-money" />
                <span className="text-ink">{p}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-10 text-xl font-bold">Dwa wydania, bo zasady się różnią</h2>
          <p className="mt-3 max-w-2xl text-muted">
            W śląskim obowiązuje jeden płaski poziom dofinansowania dla wszystkich operatorów.
            W wielkopolskim środki rozdziela siedmiu niezależnych operatorów i każdy ma własny
            próg oraz własny limit kwotowy. Dlatego poradnik ma osobne wydanie dla każdego
            z tych województw — wybierzesz swoje w formularzu obok.
          </p>

          <p className="mt-8 text-sm text-muted">
            Dofinansowanie pokrywa {SUBSIDY_RANGE} ceny kursu — {SUBSIDY_CONDITION}.
            Poradnik tłumaczy, od czego zależy Twój konkretny poziom i gdzie sprawdzisz go sama.
          </p>
        </div>

        {/* FORMULARZ */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <PoradnikForm />
        </div>
      </div>
    </div>
  );
}
