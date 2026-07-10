import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Polityka cookies | ${SITE_NAME}`,
  description: "Polityka plików cookies serwisu Uniwersytet Beauty.",
  alternates: { canonical: "/polityka-cookies" },
};

export default function PolitykaCookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Polityka cookies", url: "/polityka-cookies" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Polityka cookies</h1>
      <div className="prose-ub mt-8">
        <h2>1. Czym są pliki cookies</h2>
        <p>
          Cookies to niewielkie pliki tekstowe zapisywane na Twoim urządzeniu podczas korzystania z serwisu
          uniwersytetbeauty.pl.
        </p>
        <h2>2. Jakie cookies stosujemy</h2>
        <ul>
          <li><strong>Niezbędne</strong> — sesja logowania panelu (httpOnly), zabezpieczenia formularzy. Bez nich serwis nie działa poprawnie.</li>
          <li><strong>Analityczne</strong> — Google Analytics 4 (statystyki ruchu, anonimizowane IP).</li>
          <li><strong>Marketingowe</strong> — Meta Pixel (pomiar skuteczności reklam na Facebooku i Instagramie).</li>
        </ul>
        <h2>3. Zarządzanie cookies</h2>
        <p>
          Możesz zablokować lub usunąć cookies w ustawieniach swojej przeglądarki. Zablokowanie cookies
          analitycznych i marketingowych nie wpływa na możliwość korzystania z serwisu.
        </p>
        <h2>4. Cookies podmiotów trzecich</h2>
        <p>
          Narzędzia Google LLC oraz Meta Platforms Inc. mogą zapisywać własne pliki cookies zgodnie ze swoimi
          politykami prywatności.
        </p>
      </div>
    </div>
  );
}
