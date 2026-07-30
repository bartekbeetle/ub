import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CONTACT_EMAIL, OPERATOR, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Polityka prywatności`,
  description: "Polityka prywatności serwisu Uniwersytet Beauty — zasady przetwarzania danych osobowych (RODO).",
  alternates: { canonical: "/polityka-prywatnosci" },
  // Boilerplate prawny — noindex,follow: nie ma wartości rankingowej, a linki wewnętrzne
  // mają być dalej crawlowane.
  robots: { index: false, follow: true },
};

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Polityka prywatności", url: "/polityka-prywatnosci" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Polityka prywatności</h1>
      <p className="mt-2 text-sm text-muted">Wersja z 30 lipca 2026 r.</p>
      <div className="prose-ub mt-8">
        <h2>1. Administrator danych</h2>
        <p>
          Administratorem Twoich danych osobowych jest <strong>{OPERATOR.legalName}</strong>, prowadzący
          działalność gospodarczą pod firmą {OPERATOR.legalName} {OPERATOR.tradeName}, {OPERATOR.street},{" "}
          {OPERATOR.postalCode} {OPERATOR.city}, NIP {OPERATOR.nip}, REGON {OPERATOR.regon} — operator serwisu
          uniwersytetbeauty.pl działającego pod marką {SITE_NAME}.
        </p>
        <p>
          Kontakt w sprawach danych osobowych: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          Administrator nie wyznaczył inspektora ochrony danych — wszystkie sprawy prowadzi bezpośrednio.
        </p>

        <h2>2. Jakie dane przetwarzamy</h2>
        <p>
          Dane podane w formularzu zgłoszeniowym: imię i nazwisko, numer telefonu, adres e-mail, województwo,
          wybraną kategorię szkolenia, status zawodowy i (opcjonalnie) preferowany termin. Dodatkowo dane
          techniczne: adres IP, informacje o źródle wizyty (parametry kampanii) oraz — za Twoją zgodą — dane z
          cookies analitycznych i marketingowych.
        </p>
        <p>
          Podanie danych jest dobrowolne, ale niezbędne, żeby przekazać zgłoszenie trenerce. Nie zbieramy
          danych szczególnych kategorii (m.in. o zdrowiu) i prosimy, żeby nie podawać ich w treści wiadomości.
        </p>

        <h2>3. Cele i podstawy prawne</h2>
        <table>
          <thead>
            <tr>
              <th>Cel</th>
              <th>Podstawa prawna</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Przekazanie Twoich danych kontaktowych maksymalnie trzem trenerkom dopasowanym do kategorii szkolenia i województwa, żeby przedstawiły Ci ofertę</td>
              <td>Twoja zgoda — art. 6 ust. 1 lit. a RODO</td>
            </tr>
            <tr>
              <td>Kontakt telefoniczny i SMS w sprawie szkolenia i dofinansowania</td>
              <td>Twoja odrębna zgoda — art. 6 ust. 1 lit. a RODO w zw. z art. 398 Prawa komunikacji elektronicznej</td>
            </tr>
            <tr>
              <td>Wysyłka informacji marketingowych e-mailem (naboru, terminy, zmiany w dofinansowaniach)</td>
              <td>Twoja odrębna, dobrowolna zgoda — art. 6 ust. 1 lit. a RODO</td>
            </tr>
            <tr>
              <td>Obsługa zapytań z formularza kontaktowego i reklamacji</td>
              <td>Nasz prawnie uzasadniony interes — art. 6 ust. 1 lit. f RODO</td>
            </tr>
            <tr>
              <td>Wykazanie, kiedy i na co wyraziłaś zgodę (rozliczalność), oraz dochodzenie i obrona roszczeń</td>
              <td>Obowiązek prawny i prawnie uzasadniony interes — art. 6 ust. 1 lit. c i f RODO</td>
            </tr>
            <tr>
              <td>Statystyka ruchu i pomiar skuteczności reklam (Google Analytics 4, Meta Pixel)</td>
              <td>Twoja zgoda w banerze cookies — art. 6 ust. 1 lit. a RODO</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Każdą zgodę możesz wycofać w dowolnym momencie</strong>, pisząc na {CONTACT_EMAIL}.
          Wycofanie nie wpływa na zgodność z prawem przetwarzania sprzed wycofania. Wycofanie zgody na
          przekazanie danych trenerkom nie cofa jednak danych już im przekazanych — od tego momentu to one
          decydują o dalszym przetwarzaniu (patrz punkt 4) i żądanie usunięcia warto skierować także do nich.
        </p>

        <h2>4. Odbiorcy danych — status trenerek</h2>
        <p>
          Dane ze zgłoszenia przekazujemy wyłącznie trenerkom współpracującym z serwisem, dopasowanym do
          kategorii szkolenia i województwa — <strong>maksymalnie trzem</strong>. Trenerka staje się wówczas{" "}
          <strong>odrębnym administratorem</strong> Twoich danych i odpowiada za ich dalsze przetwarzanie
          (kontakt z Tobą, ewentualna umowa o szkolenie, obsługa wniosku o dofinansowanie). Zakres jej
          obowiązków — w tym zakaz wykorzystywania danych do innych celów i obowiązek usunięcia ich po
          zakończeniu kontaktu — reguluje umowa, którą z nami zawarła.
        </p>
        <p>
          Poza tym dane mogą przetwarzać nasi dostawcy techniczni na podstawie umów powierzenia: dostawca
          serwera (hosting w Unii Europejskiej), dostawca poczty oraz — w zakresie danych z cookies — Google
          Ireland Ltd. i Meta Platforms Ireland Ltd. Nie sprzedajemy danych i nie przekazujemy ich nikomu poza
          tym kręgiem.
        </p>

        <h2>5. Przekazywanie poza EOG</h2>
        <p>
          Dane z cookies analitycznych i marketingowych mogą trafić do Stanów Zjednoczonych (Google, Meta) na
          podstawie decyzji Komisji Europejskiej o odpowiednim stopniu ochrony (Data Privacy Framework) oraz
          standardowych klauzul umownych. Pozostałe dane przetwarzamy na terenie Europejskiego Obszaru
          Gospodarczego.
        </p>

        <h2>6. Okres przechowywania</h2>
        <ul>
          <li>dane zgłoszenia — do 24 miesięcy od ostatniego kontaktu, a jeśli doszło do rozliczenia z trenerką, przez okres wymagany przepisami podatkowymi (5 lat od końca roku podatkowego),</li>
          <li>dane przetwarzane na podstawie zgody marketingowej — do wycofania zgody,</li>
          <li>dowód udzielenia zgody (data, wersja klauzul) — przez okres przedawnienia roszczeń, także po usunięciu pozostałych danych,</li>
          <li>dane z cookies — przez okresy wskazane w <a href="/polityka-cookies">Polityce cookies</a>.</li>
        </ul>

        <h2>7. Twoje prawa</h2>
        <p>
          Masz prawo do: dostępu do danych i ich kopii, sprostowania, usunięcia („prawo do bycia zapomnianą” —
          na Twoje żądanie dane zgłoszenia są anonimizowane), ograniczenia przetwarzania, przenoszenia danych,
          <strong> sprzeciwu</strong> wobec przetwarzania opartego na naszym prawnie uzasadnionym interesie
          oraz cofnięcia każdej ze zgód. Żądania kieruj na {CONTACT_EMAIL} — odpowiadamy w terminie miesiąca.
          Przysługuje Ci też skarga do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).
        </p>

        <h2>8. Zautomatyzowane podejmowanie decyzji</h2>
        <p>
          Dobór trenerek do Twojego zgłoszenia odbywa się automatycznie, na podstawie wybranej kategorii
          szkolenia i województwa. Nie jest to decyzja wywołująca wobec Ciebie skutki prawne ani podobnie
          istotna w rozumieniu art. 22 RODO — nie profilujemy Cię i nie oceniamy Twojej sytuacji osobistej.
        </p>

        <h2>9. Bezpieczeństwo</h2>
        <p>
          Stosujemy szyfrowanie transmisji (TLS), kontrolę dostępu do danych, maskowanie danych kontaktowych w
          panelach wewnętrznych oraz rejestrowanie operacji na danych (audit log).
        </p>

        <h2>10. Pliki cookies</h2>
        <p>Zasady wykorzystania plików cookies opisuje <a href="/polityka-cookies">Polityka cookies</a>.</p>
      </div>
    </div>
  );
}
