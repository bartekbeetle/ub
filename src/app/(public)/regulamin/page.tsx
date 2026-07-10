import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Regulamin serwisu | ${SITE_NAME}`,
  description: "Regulamin korzystania z serwisu Uniwersytet Beauty.",
  alternates: { canonical: "/regulamin" },
};

export default function RegulaminPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Regulamin", url: "/regulamin" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Regulamin serwisu</h1>
      <div className="prose-ub mt-8">
        <h2>§1. Postanowienia ogólne</h2>
        <p>
          1. Serwis internetowy Uniwersytet Beauty (dalej: „Serwis”) prowadzony jest pod adresem
          uniwersytetbeauty.pl. 2. Serwis pełni funkcję platformy informacyjnej łączącej osoby zainteresowane
          szkoleniami z branży beauty (dalej: „Kandydatki”) z niezależnymi trenerkami i firmami szkoleniowymi
          (dalej: „Trenerki”). 3. Kontakt z operatorem Serwisu: {CONTACT_EMAIL}.
        </p>
        <h2>§2. Charakter usług</h2>
        <p>
          1. Serwis nie jest organizatorem szkoleń — umowa o przeprowadzenie szkolenia zawierana jest
          bezpośrednio pomiędzy Kandydatką a Trenerką. 2. Korzystanie z Serwisu przez Kandydatki, w tym
          przesłanie formularza zgłoszeniowego oraz konsultacja dotycząca dofinansowań, jest bezpłatne.
          3. Serwis nie gwarantuje przyznania dofinansowania — decyzję podejmuje właściwy operator programu
          (m.in. BUR, PUP, KFS).
        </p>
        <h2>§3. Formularz zgłoszeniowy</h2>
        <p>
          1. Przesłanie formularza oznacza zgodę na kontakt ze strony Serwisu oraz przekazanie danych
          kontaktowych maksymalnie trzem Trenerkom dopasowanym do wybranej kategorii szkolenia i województwa.
          2. Zasady przetwarzania danych osobowych określa <a href="/polityka-prywatnosci">Polityka prywatności</a>.
        </p>
        <h2>§4. Odpowiedzialność</h2>
        <p>
          1. Operator dokłada starań, aby informacje w Serwisie (ceny, terminy, programy szkoleń) były aktualne,
          jednak wiążące informacje przekazuje każdorazowo Trenerka. 2. Operator nie ponosi odpowiedzialności za
          przebieg i jakość szkoleń realizowanych przez Trenerki.
        </p>
        <h2>§5. Reklamacje</h2>
        <p>
          Reklamacje dotyczące działania Serwisu można zgłaszać na adres {CONTACT_EMAIL}. Odpowiadamy w terminie
          14 dni.
        </p>
        <h2>§6. Postanowienia końcowe</h2>
        <p>
          Operator zastrzega sobie prawo zmiany Regulaminu. W sprawach nieuregulowanych stosuje się przepisy
          prawa polskiego.
        </p>
      </div>
    </div>
  );
}
