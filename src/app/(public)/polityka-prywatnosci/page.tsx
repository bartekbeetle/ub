import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Polityka prywatności`,
  description: "Polityka prywatności serwisu Uniwersytet Beauty — zasady przetwarzania danych osobowych (RODO).",
  alternates: { canonical: "/polityka-prywatnosci" },
};

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Polityka prywatności", url: "/polityka-prywatnosci" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Polityka prywatności</h1>
      <div className="prose-ub mt-8">
        <h2>1. Administrator danych</h2>
        <p>
          Administratorem danych osobowych przekazywanych w serwisie uniwersytetbeauty.pl jest operator serwisu
          Uniwersytet Beauty. Kontakt w sprawach danych osobowych: {CONTACT_EMAIL}.
        </p>
        <h2>2. Jakie dane przetwarzamy i po co</h2>
        <p>Przetwarzamy dane podane w formularzach: imię i nazwisko, numer telefonu, adres e-mail, województwo, wybraną kategorię szkolenia oraz status zawodowy. Cele przetwarzania:</p>
        <ul>
          <li>przedstawienie oferty szkoleniowej i pomoc w uzyskaniu dofinansowania (art. 6 ust. 1 lit. b i f RODO),</li>
          <li>przekazanie danych kontaktowych maksymalnie trzem trenerkom dopasowanym do zgłoszenia — na podstawie Twojej zgody (art. 6 ust. 1 lit. a RODO),</li>
          <li>obsługa zapytań z formularza kontaktowego,</li>
          <li>analityka ruchu (Google Analytics 4, Meta Pixel) — na podstawie zgody cookies.</li>
        </ul>
        <h2>3. Odbiorcy danych</h2>
        <p>
          Dane z formularza zgłoszeniowego przekazujemy wyłącznie trenerkom współpracującym z serwisem,
          dopasowanym do kategorii szkolenia i województwa (maksymalnie 3). Dane mogą przetwarzać także nasi
          dostawcy hostingu i poczty — na podstawie umów powierzenia.
        </p>
        <h2>4. Okres przechowywania</h2>
        <p>
          Dane przechowujemy przez okres niezbędny do obsługi zgłoszenia, nie dłużej niż 24 miesiące od
          ostatniego kontaktu, chyba że przepisy wymagają dłuższego okresu.
        </p>
        <h2>5. Twoje prawa</h2>
        <p>
          Masz prawo do: dostępu do danych, sprostowania, usunięcia („prawo do bycia zapomnianą” — na Twoje
          żądanie dane zgłoszenia są anonimizowane), ograniczenia przetwarzania, przenoszenia danych, cofnięcia
          zgody w dowolnym momencie oraz wniesienia skargi do Prezesa UODO. Żądania kieruj na {CONTACT_EMAIL}.
        </p>
        <h2>6. Bezpieczeństwo</h2>
        <p>
          Stosujemy szyfrowanie transmisji (TLS), kontrolę dostępu do danych, maskowanie danych kontaktowych w
          panelach wewnętrznych oraz rejestrowanie operacji na danych (audit log).
        </p>
        <h2>7. Pliki cookies</h2>
        <p>Zasady wykorzystania plików cookies opisuje <a href="/polityka-cookies">Polityka cookies</a>.</p>
      </div>
    </div>
  );
}
