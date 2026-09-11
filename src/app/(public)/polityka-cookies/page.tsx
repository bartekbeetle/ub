import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CONTACT_EMAIL, OPERATOR_LINE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Polityka cookies`,
  description: "Polityka plików cookies serwisu Uniwersytet Beauty.",
  alternates: { canonical: "/polityka-cookies" },
  // Boilerplate prawny — noindex,follow: nie ma wartości rankingowej, a linki wewnętrzne
  // (do polityki prywatności itd.) mają być dalej crawlowane.
  robots: { index: false, follow: true },
};

export default function PolitykaCookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Polityka cookies", url: "/polityka-cookies" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Polityka cookies</h1>
      <p className="mt-2 text-sm text-muted">Wersja z 30 lipca 2026 r.</p>
      <div className="prose-ub mt-8">
        <h2>1. Czym są pliki cookies</h2>
        <p>
          Cookies to niewielkie pliki tekstowe zapisywane na Twoim urządzeniu podczas korzystania z serwisu
          uniwersytetbeauty.pl. Podmiotem zamieszczającym cookies jest {OPERATOR_LINE}.
        </p>

        <h2>2. Kiedy pytamy o zgodę</h2>
        <p>
          Cookies <strong>niezbędne</strong> zapisujemy zawsze — bez nich serwis nie działa (art. 173 ust. 3
          Prawa komunikacji elektronicznej). Cookies <strong>analityczne</strong> i{" "}
          <strong>marketingowe</strong> zapisujemy <strong>wyłącznie po Twojej zgodzie</strong>, wyrażonej
          osobno dla każdej z tych kategorii w banerze cookies. Do momentu wyrażenia zgody na stronie nie
          uruchamia się żaden skrypt śledzący — brak decyzji traktujemy jak odmowę.
        </p>

        <h2>3. Jakie cookies stosujemy</h2>
        <table>
          <thead>
            <tr>
              <th>Kategoria</th>
              <th>Kto zapisuje</th>
              <th>Cel</th>
              <th>Okres</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Niezbędne</td>
              <td>Uniwersytet Beauty</td>
              <td>Sesja logowania do panelu (cookie httpOnly), zabezpieczenie formularzy przed nadużyciami, zapamiętanie Twojej decyzji o cookies</td>
              <td>Do końca sesji / do 12 miesięcy</td>
            </tr>
            <tr>
              <td>Analityczne (zgoda)</td>
              <td>Google Ireland Ltd. — Google Analytics 4</td>
              <td>Statystyka ruchu: które strony są czytane, skąd przychodzą użytkowniczki. IP anonimizowane.</td>
              <td>Do 14 miesięcy</td>
            </tr>
            <tr>
              <td>Marketingowe (zgoda)</td>
              <td>Meta Platforms Ireland Ltd. — Meta Pixel</td>
              <td>Pomiar skuteczności reklam na Facebooku i Instagramie, dobór odbiorców reklam</td>
              <td>Do 3 miesięcy (identyfikator <code>_fbp</code>)</td>
            </tr>
          </tbody>
        </table>

        <h2>4. Przekazywanie danych poza Europejski Obszar Gospodarczy</h2>
        <p>
          Google i Meta mogą przekazywać dane zebrane przez cookies do Stanów Zjednoczonych. Odbywa się to na
          podstawie decyzji Komisji Europejskiej o odpowiednim stopniu ochrony (Data Privacy Framework) oraz
          standardowych klauzul umownych. Jeśli nie chcesz takiego transferu — nie wyrażaj zgody na cookies
          analityczne i marketingowe; serwis działa wtedy bez żadnych ograniczeń.
        </p>

        <h2>5. Wycofanie zgody i zarządzanie cookies</h2>
        <p>
          Zgodę możesz wycofać w każdej chwili i równie łatwo, jak jej udzieliłaś — kliknij{" "}
          <strong>„Ustawienia cookies”</strong> w stopce serwisu, a baner pojawi się ponownie i pozwoli
          zmienić wybór. Cookies możesz też zablokować lub usunąć w ustawieniach przeglądarki. Wycofanie zgody
          nie wpływa na zgodność z prawem przetwarzania dokonanego wcześniej ani na możliwość korzystania z
          serwisu.
        </p>

        <h2>6. Twoje dane i kontakt</h2>
        <p>
          Zasady przetwarzania danych osobowych, w tym danych zbieranych przez cookies, opisuje{" "}
          <a href="/polityka-prywatnosci">Polityka prywatności</a>. Pytania: {CONTACT_EMAIL}.
        </p>
      </div>
    </div>
  );
}
