import type { Metadata } from "next";
import Image from "next/image";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { TrackEvent } from "@/components/TrackEvent";
import { CheckoutLink } from "@/components/CheckoutLink";
import { IconCheck, IconFileText, IconShield, IconChevronDown } from "@/components/icons";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/constants";
import { PORADNIK_SALON as P, PORADNIK_SALON_W_SPRZEDAZY as W_SPRZEDAZY } from "@/lib/produkty";

const URL_STRONY = `/${P.slug}`;
const TYTUL = `${P.tytul}. ${P.podtytul} — poradnik PDF`;
const OPIS =
  "Poradnik dla kobiet, które otwierają salon albo gabinet beauty lub chcą rozwinąć istniejący: formalności i sanepid, ulgi w ZUS, kasa fiskalna, Profil Firmy w Google, opinie zgodne z zasadami, ceny i nowe usługi. Stan prawny: wrzesień 2026.";

export const metadata: Metadata = {
  title: { absolute: TYTUL },
  description: OPIS,
  alternates: { canonical: URL_STRONY },
  // Do startu sprzedaży strona nie może się indeksować — Google pokazałby produkt, którego nie da się kupić.
  robots: W_SPRZEDAZY ? undefined : { index: false, follow: true },
  openGraph: {
    title: TYTUL,
    description: OPIS,
    url: URL_STRONY,
    type: "website",
    locale: "pl_PL",
    siteName: SITE_NAME,
    images: [{ url: "/poradniki/wlasny-salon/okladka.webp", width: 1109, height: 1576 }],
  },
};

const DLA_KOGO = [
  {
    tytul: "Otwierasz salon albo gabinet",
    punkty: [
      "Wiesz, jakie formalności załatwić przed pierwszą płatną usługą i w jakiej kolejności",
      "Liczysz, ile wizyt w miesiącu musi utrzymać lokal, zanim podpiszesz umowę najmu",
      "Znasz wymagania sanitarne, zanim zaczniesz remont, a nie po kontroli",
    ],
  },
  {
    tytul: "Prowadzisz salon, ale grafik ma dziury",
    punkty: [
      "Ustawiasz Profil Firmy w Google tak, żeby klientki z okolicy dzwoniły",
      "Zbierasz opinie w sposób, który nie grozi zawieszeniem profilu ani karą",
      "Wiesz, które z czterech liczb salonu jest problemem i co z nim zrobić",
    ],
  },
];

const CZESCI = [
  {
    nr: "Część I",
    nazwa: "Otwarcie salonu",
    rozdzialy: [
      "Zanim podpiszesz umowę najmu: trzy modele startu i rachunek progu",
      "Formalności: działalność nierejestrowana czy JDG, PKD 2025, ulgi w ZUS, VAT, kasa fiskalna, RODO",
      "Sanepid i lokal: czy zgłaszać otwarcie, wymagania, procedury, sterylizacja, odpady",
      "Pieniądze na start i szkolenia: dotacja z urzędu pracy, BUR, Krajowy Fundusz Szkoleniowy",
    ],
  },
  {
    nr: "Część II",
    nazwa: "Klientki z Google",
    rozdzialy: [
      "Założenie i weryfikacja Profilu Firmy w Google, także przez wideo",
      "Co wpisać w profil, żeby klientka zadzwoniła: usługi, ceny, opis, zdjęcia",
      "Opinie zgodne z zasadami Google i polskim prawem, z gotowymi tekstami",
      "Posty, statystyki i polecenia do AI, które oszczędzają czas",
    ],
  },
  {
    nr: "Część III",
    nazwa: "Rozwój salonu, który już działa",
    rozdzialy: [
      "Cztery liczby: obłożenie, powroty, wartość wizyty, źródło klientki",
      "Nieobecności: zadatek a zaliczka, regulamin rezerwacji",
      "Podwyżka cen i pakiety bez obniżania ceny podstawowej usługi",
      "Nowa usługa i pierwsza pracownica albo wynajem stanowiska",
    ],
  },
];

const WYROZNIKI = [
  {
    tytul: "Aktualny stan prawny",
    tekst:
      "Kody PKD po podziale z 2025 roku, limit zwolnienia z VAT 240 000 zł i kwartalny limit działalności nierejestrowanej obowiązujące od 2026 roku.",
  },
  {
    tytul: "Źródło przy każdej liczbie",
    tekst:
      "Przepisy, wytyczne sanepidu i zasady Google z linkami do źródeł. Każdą informację możesz sprawdzić sama.",
  },
  {
    tytul: "Gotowe teksty do skopiowania",
    tekst:
      "SMS z prośbą o opinię, odpowiedzi na opinie pozytywne i negatywne, polecenia do AI na opis profilu i posty.",
  },
  {
    tytul: "Plan na pierwsze 30 dni",
    tekst: "Lista zadań na cztery tygodnie do odhaczania: formalności, profil w Google, opinie i stały rytm.",
  },
];

const PODGLAD = [
  { src: "/poradniki/wlasny-salon/spis.webp", alt: "Spis treści poradnika" },
  { src: "/poradniki/wlasny-salon/formalnosci.webp", alt: "Strona z rozdziału o formalnościach: ulgi w ZUS" },
  { src: "/poradniki/wlasny-salon/opinie.webp", alt: "Strona z rozdziału o opiniach w Google" },
  { src: "/poradniki/wlasny-salon/plan.webp", alt: "Plan na pierwsze 30 dni" },
];

const FAQ = [
  {
    q: "W jakiej formie jest poradnik?",
    a: `Plik PDF, ${P.strony} stron. Czytasz go na telefonie, komputerze albo drukujesz. Linki do źródeł w pliku są klikalne.`,
  },
  {
    q: "Kiedy go dostanę?",
    a: "Link do pobrania przychodzi na adres e-mail podany przy płatności, zaraz po jej zaksięgowaniu.",
  },
  {
    q: "Czy poradnik zastępuje księgową albo prawnika?",
    a: "Nie. Porządkuje przepisy i pokazuje, o co zapytać, ale formę opodatkowania dobierzesz z księgową, a wymagania dla konkretnego lokalu potwierdzisz w swojej powiatowej stacji sanitarno-epidemiologicznej. Tam, gdzie przepisy dopuszczają lokalne różnice, poradnik mówi to wprost.",
  },
  {
    q: "Czy dotyczy gabinetów medycyny estetycznej?",
    a: "Tylko częściowo. Poradnik opisuje gabinety kosmetyczne i salony beauty prowadzone bez kwalifikacji medycznych. Gabinet lekarski prowadzący działalność leczniczą podlega innym przepisom, których poradnik nie omawia.",
  },
  {
    q: "Czy w poradniku są linki reklamowe?",
    a: "Jeden: link partnerski do narzędzia do planowania postów w Google, oznaczony w treści. Wszystkie opisane kroki wykonasz bez niego, bezpłatnie.",
  },
  {
    q: "Potrzebuję faktury.",
    a: `Napisz na ${CONTACT_EMAIL} i podaj numer zamówienia oraz dane firmy. Sprzedawca jest zwolniony z VAT.`,
  },
];

function PrzyciskZakupu({ className = "" }: { className?: string }) {
  if (!W_SPRZEDAZY) {
    return (
      <p className={`rounded-full bg-sand-100 px-6 py-3 text-center text-sm font-semibold text-sand-700 ${className}`}>
        Sprzedaż ruszy w ciągu kilku dni
      </p>
    );
  }
  return (
    <CheckoutLink
      href={P.checkoutUrl}
      contentName={P.tytul}
      value={P.cena}
      className={`btn-primary w-full ${className}`}
    >
      Kupuję poradnik za {P.cena} zł
    </CheckoutLink>
  );
}

function BoxCeny() {
  return (
    <div className="card p-6">
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-4xl font-bold text-ink-soft">{P.cena} zł</span>
        <span className="text-sm text-muted">jednorazowo</span>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-ink">
        <li className="flex gap-2">
          <IconFileText width={18} height={18} className="mt-0.5 shrink-0 text-sand-700" />
          PDF, {P.strony} stron, dostęp od razu po płatności
        </li>
        <li className="flex gap-2">
          <IconShield width={18} height={18} className="mt-0.5 shrink-0 text-sand-700" />
          Stan prawny: wrzesień 2026, źródło przy każdej liczbie
        </li>
      </ul>
      <PrzyciskZakupu className="mt-5" />
    </div>
  );
}

export default function PoradnikSalonPage() {
  const produktJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${P.tytul}. ${P.podtytul}`,
    description: OPIS,
    image: `${SITE_URL}/poradniki/wlasny-salon/okladka.webp`,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      price: P.cena,
      priceCurrency: "PLN",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}${URL_STRONY}`,
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      {W_SPRZEDAZY && <JsonLd data={produktJsonLd} />}
      <TrackEvent
        event="view_item"
        params={{ content_name: P.tytul, content_type: "product", value: P.cena, currency: "PLN" }}
      />
      <Breadcrumbs
        items={[
          { name: "Strona główna", url: "/" },
          { name: P.tytul, url: URL_STRONY },
        ]}
      />

      {/* HERO */}
      <section className="mt-6 grid items-start gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-sand-700">Poradnik praktyczny · PDF</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight md:text-5xl">
            {P.tytul}. <span className="italic text-sand-700">{P.podtytul}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Co załatwić przed pierwszą klientką, jak ustawić profil w Google, żeby kobiety z okolicy
            dzwoniły, i jak rozwijać salon, który już działa. Konkretnie, z przepisami aktualnymi
            na wrzesień 2026 roku i źródłem przy każdej liczbie.
          </p>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
            <Image
              src="/poradniki/wlasny-salon/okladka.webp"
              alt={`Okładka poradnika „${P.tytul}”`}
              width={1109}
              height={1576}
              priority
              sizes="(min-width: 640px) 220px, 60vw"
              className="w-[60%] max-w-[220px] rounded-[6px] shadow-card ring-1 ring-sand-200 sm:w-[220px]"
            />
            <ul className="space-y-3 text-ink">
              {["15 rozdziałów w trzech częściach", "Gotowe teksty: SMS, odpowiedzi na opinie, polecenia do AI", "Plan na pierwsze 30 dni do odhaczania", "Tabela źródeł z linkami"].map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <IconCheck width={18} height={18} className="mt-0.5 shrink-0 text-sand-700" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:sticky lg:top-24">
          <BoxCeny />
        </div>
      </section>

      {/* DLA KOGO */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold md:text-3xl">Dla kogo jest ten poradnik</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {DLA_KOGO.map((g) => (
            <div key={g.tytul} className="rounded-[12px] border border-sand-200 bg-white p-6">
              <h3 className="text-xl font-semibold">{g.tytul}</h3>
              <ul className="mt-4 space-y-3">
                {g.punkty.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-ink">
                    <IconCheck width={18} height={18} className="mt-0.5 shrink-0 text-sand-700" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CO W ŚRODKU */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold md:text-3xl">Co jest w środku</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {CZESCI.map((c) => (
            <div key={c.nr} className="rounded-[12px] bg-sand-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-sand-700">{c.nr}</p>
              <h3 className="mt-1 text-xl font-semibold">{c.nazwa}</h3>
              <ol className="mt-4 space-y-2.5 text-sm text-ink">
                {c.rozdzialy.map((r) => (
                  <li key={r} className="border-t border-sand-200 pt-2.5">
                    {r}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* WYRÓŻNIKI */}
      <section className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {WYROZNIKI.map((w) => (
          <div key={w.tytul}>
            <h3 className="text-lg font-semibold">{w.tytul}</h3>
            <p className="mt-2 text-sm text-muted">{w.tekst}</p>
          </div>
        ))}
      </section>

      {/* PODGLĄD */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold md:text-3xl">Zajrzyj do środka</h2>
        <p className="mt-2 max-w-2xl text-muted">Cztery z {P.strony} stron poradnika.</p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {PODGLAD.map((s) => (
            <Image
              key={s.src}
              src={s.src}
              alt={s.alt}
              width={832}
              height={1182}
              sizes="(min-width: 768px) 25vw, 50vw"
              className="w-full rounded-[6px] shadow-soft ring-1 ring-sand-200"
            />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-20 max-w-3xl">
        <h2 className="text-2xl font-bold md:text-3xl">Pytania przed zakupem</h2>
        <div className="mt-6 divide-y divide-sand-200 border-y border-sand-200">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
                {f.q}
                <IconChevronDown width={18} height={18} className="shrink-0 text-sand-700 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA KOŃCOWE */}
      <section className="mt-20 rounded-[12px] bg-sand-100 p-8 md:p-12">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_340px]">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Zacznij od planu na pierwsze 30 dni</h2>
            <p className="mt-3 max-w-xl text-muted">
              Formalności w pierwszym tygodniu, profil w Google w drugim, opinie w trzecim i stały
              rytm w czwartym. Każdy krok opisany w poradniku, z gotowymi tekstami.
            </p>
          </div>
          <BoxCeny />
        </div>
      </section>
    </div>
  );
}
