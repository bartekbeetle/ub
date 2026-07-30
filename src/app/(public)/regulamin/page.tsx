import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CONTACT_EMAIL, OPERATOR, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Regulamin serwisu`,
  description: "Regulamin korzystania z serwisu Uniwersytet Beauty.",
  alternates: { canonical: "/regulamin" },
  // Boilerplate prawny — noindex,follow: nie ma wartości rankingowej, a linki wewnętrzne
  // mają być dalej crawlowane.
  robots: { index: false, follow: true },
};

export default function RegulaminPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Regulamin", url: "/regulamin" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Regulamin serwisu</h1>
      <p className="mt-2 text-sm text-muted">Wersja z 30 lipca 2026 r.</p>
      <div className="prose-ub mt-8">
        <h2>§1. Postanowienia ogólne</h2>
        <p>
          1. Serwis internetowy {SITE_NAME} (dalej: „Serwis”) prowadzony jest pod adresem uniwersytetbeauty.pl
          przez {OPERATOR.legalName}, prowadzącego działalność gospodarczą pod firmą {OPERATOR.legalName}{" "}
          {OPERATOR.tradeName}, {OPERATOR.street}, {OPERATOR.postalCode} {OPERATOR.city}, NIP {OPERATOR.nip},
          REGON {OPERATOR.regon} (dalej: „Operator”).
        </p>
        <p>
          2. Kontakt z Operatorem: {CONTACT_EMAIL}. Korespondencję pisemną kieruj na adres wskazany w ust. 1.
        </p>
        <p>3. Regulamin określa zasady korzystania z Serwisu i jest udostępniany nieodpłatnie, w formie umożliwiającej jego pobranie, utrwalenie i wydrukowanie.</p>

        <h2>§2. Definicje</h2>
        <p>
          <strong>Kandydatka</strong> — osoba fizyczna zainteresowana szkoleniem z branży beauty, korzystająca z
          Serwisu. <strong>Trenerka</strong> — niezależna trenerka, akademia lub firma szkoleniowa
          prezentowana w Serwisie, prowadząca szkolenia we własnym imieniu.{" "}
          <strong>Zgłoszenie</strong> — formularz przesłany przez Kandydatkę.{" "}
          <strong>BUR</strong> — Baza Usług Rozwojowych prowadzona przez Polską Agencję Rozwoju
          Przedsiębiorczości.
        </p>

        <h2>§3. Charakter usług</h2>
        <p>
          1. Serwis pełni funkcję platformy informacyjnej i kojarzącej: łączy Kandydatki z Trenerkami.{" "}
          <strong>Operator nie jest organizatorem szkoleń</strong> — umowa o przeprowadzenie szkolenia
          zawierana jest bezpośrednio pomiędzy Kandydatką a Trenerką i to Trenerka odpowiada za jej wykonanie.
        </p>
        <p>
          2. Korzystanie z Serwisu przez Kandydatki — w tym przesłanie Zgłoszenia oraz konsultacja dotycząca
          dofinansowania — jest <strong>bezpłatne</strong>. Operator nie pobiera od Kandydatek żadnych opłat,
          prowizji ani wynagrodzenia; rozlicza się wyłącznie z Trenerkami.
        </p>
        <p>
          3. <strong>Operator nie gwarantuje przyznania dofinansowania</strong> — decyzję podejmuje właściwy
          operator programu (m.in. BUR, PUP, KFS) według własnych kryteriów. Informacje o poziomie
          dofinansowania (np. „do 90%”) mają charakter orientacyjny; rzeczywista wysokość dopłaty i kwota do
          zapłaty przez Kandydatkę zależą od programu, regionu i sytuacji zawodowej Kandydatki.
        </p>
        <p>
          4. Operator nie gwarantuje dostępności konkretnego terminu, ceny ani miejsca na szkoleniu —
          wiążące informacje przekazuje każdorazowo Trenerka.
        </p>

        <h2>§4. Wymagania techniczne</h2>
        <p>
          Do korzystania z Serwisu potrzebne są: urządzenie z dostępem do internetu, aktualna przeglądarka
          internetowa z obsługą JavaScript i plików cookies oraz — dla przesłania Zgłoszenia — aktywny adres
          e-mail i numer telefonu. Operator nie ponosi odpowiedzialności za problemy wynikające z
          niespełnienia tych wymagań po stronie użytkowniczki.
        </p>

        <h2>§5. Zawarcie i rozwiązanie umowy o świadczenie usług drogą elektroniczną</h2>
        <p>
          1. Umowa o świadczenie usługi drogą elektroniczną (przeglądanie Serwisu) zawierana jest z chwilą
          wejścia na stronę i rozwiązuje się z chwilą jej opuszczenia. 2. Umowa dotycząca obsługi Zgłoszenia
          zawierana jest z chwilą przesłania formularza i trwa do zakończenia jego obsługi. 3. Kandydatka może
          w każdej chwili zrezygnować, informując o tym na {CONTACT_EMAIL}; skutkuje to zaprzestaniem kontaktu
          i — na żądanie — anonimizacją danych.
        </p>

        <h2>§6. Formularz zgłoszeniowy</h2>
        <p>
          1. Przesłanie Zgłoszenia wymaga zaznaczenia odrębnych zgód: na przetwarzanie danych i przekazanie ich
          maksymalnie trzem Trenerkom oraz na kontakt telefoniczny/SMS. Zgoda na marketing e-mailowy jest
          dobrowolna i nie warunkuje obsługi Zgłoszenia.
        </p>
        <p>
          2. Kandydatka podaje dane prawdziwe i dotyczące jej samej. Zabronione jest przesyłanie danych osób
          trzecich bez ich wiedzy.
        </p>
        <p>
          3. Zasady przetwarzania danych osobowych, w tym status Trenerek jako odrębnych administratorów,
          określa <a href="/polityka-prywatnosci">Polityka prywatności</a>.
        </p>

        <h2>§7. Zasady korzystania z Serwisu</h2>
        <p>
          Zabronione jest dostarczanie treści o charakterze bezprawnym, podejmowanie działań zakłócających
          działanie Serwisu (w tym automatyczne masowe wysyłanie formularzy) oraz pobieranie i wykorzystywanie
          zawartości Serwisu w sposób naruszający prawa Operatora lub Trenerek.
        </p>

        <h2>§8. Opinie i oceny prezentowane w Serwisie</h2>
        <p>
          1. Przy profilach Trenerek Operator może prezentować opinie pochodzące z <strong>publicznych
          profili Google (Google Business Profile)</strong> danej Trenerki, wraz ze wskazaniem źródła i daty
          pobrania. Operator nie zbiera tych opinii samodzielnie i ich nie modyfikuje ani nie usuwa
          pojedynczych opinii negatywnych.
        </p>
        <p>
          2. <strong>Operator nie weryfikuje, czy autorki opinii faktycznie skorzystały ze szkolenia</strong> —
          opinie są przenoszone w postaci opublikowanej przez Google, a ich autentyczność zależy od mechanizmów
          weryfikacji stosowanych przez Google. Informacja ta jest podawana zgodnie z art. 12 ust. 1 pkt 22
          ustawy o prawach konsumenta.
        </p>
        <p>
          3. Operator nie zamieszcza opinii nieprawdziwych ani nie zleca ich tworzenia. Zgłoszenia dotyczące
          konkretnej opinii przyjmuje adres {CONTACT_EMAIL}.
        </p>

        <h2>§9. Odpowiedzialność</h2>
        <p>
          1. Operator dokłada starań, aby informacje w Serwisie (ceny, terminy, programy szkoleń) były
          aktualne, jednak wiążące informacje przekazuje każdorazowo Trenerka. 2. Operator nie ponosi
          odpowiedzialności za przebieg, jakość i rozliczenie szkoleń realizowanych przez Trenerki ani za
          decyzje operatorów programów dofinansowań. 3. Powyższe ograniczenia nie wyłączają ani nie ograniczają
          odpowiedzialności Operatora w zakresie, w jakim jest to niedopuszczalne wobec konsumenta na gruncie
          bezwzględnie obowiązujących przepisów.
        </p>

        <h2>§10. Reklamacje</h2>
        <p>
          1. Reklamacje dotyczące działania Serwisu można zgłaszać na adres {CONTACT_EMAIL}, podając opis
          sprawy i dane kontaktowe. Operator odpowiada w terminie 14 dni od otrzymania reklamacji.
        </p>
        <p>
          2. Reklamacje dotyczące samego szkolenia należy kierować bezpośrednio do Trenerki, która je
          przeprowadziła.
        </p>
        <p>
          3. Konsumentka może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia
          roszczeń, m.in. przed wojewódzkim inspektorem Inspekcji Handlowej lub z pomocą powiatowego
          (miejskiego) rzecznika konsumentów, a także z unijnej platformy ODR dostępnej pod adresem{" "}
          <a href="https://ec.europa.eu/consumers/odr" rel="nofollow noopener" target="_blank">
            ec.europa.eu/consumers/odr
          </a>
          . Skorzystanie z nich jest dobrowolne.
        </p>

        <h2>§11. Prawa autorskie</h2>
        <p>
          Treści Serwisu (teksty, grafiki, układ) podlegają ochronie prawnoautorskiej i przysługują Operatorowi
          lub podmiotom, które udzieliły mu licencji — w tym Trenerkom w zakresie ich zdjęć i opisów.
          Korzystanie z nich poza dozwolonym użytkiem wymaga zgody uprawnionego.
        </p>

        <h2>§12. Zmiany Regulaminu</h2>
        <p>
          Operator może zmienić Regulamin z ważnych przyczyn (zmiana przepisów, zakresu usług, wymogów
          technicznych). Zmieniony Regulamin publikowany jest w Serwisie ze wskazaniem daty wejścia w życie, nie
          krótszą niż 7 dni od publikacji. Do Zgłoszeń przesłanych przed zmianą stosuje się Regulamin w
          brzmieniu z dnia przesłania Zgłoszenia.
        </p>

        <h2>§13. Postanowienia końcowe</h2>
        <p>
          W sprawach nieuregulowanych stosuje się przepisy prawa polskiego, w szczególności Kodeksu cywilnego,
          ustawy o świadczeniu usług drogą elektroniczną oraz ustawy o prawach konsumenta. Wybór prawa polskiego
          nie pozbawia konsumentki ochrony wynikającej z bezwzględnie obowiązujących przepisów prawa państwa jej
          miejsca zwykłego pobytu.
        </p>
      </div>
    </div>
  );
}
