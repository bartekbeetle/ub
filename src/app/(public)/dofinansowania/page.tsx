import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { SubsidyCalculator } from "@/components/SubsidyCalculator";
import { faqJsonLd } from "@/lib/seo";
import { IconCheck, IconChevronDown } from "@/components/icons";
import { SITE_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Dofinansowania na szkolenia beauty — BUR, UP, KFS | ${SITE_NAME}`,
  description:
    "Szkolenie beauty za 0 zł? Sprawdź programy dofinansowań: BUR do 100%, Urząd Pracy 85%+, KFS. Kalkulator oszczędności i wsparcie w całym procesie wniosku.",
  alternates: { canonical: "/dofinansowania" },
};

const PROGRAMS = [
  {
    name: "Baza Usług Rozwojowych (BUR)",
    percent: "100%",
    description:
      "Największy program dofinansowań szkoleń w Polsce, finansowany z Funduszy Europejskich. Nie musisz być bezrobotna!",
    requirements: [
      "Dla pracujących, studentek, przedsiębiorczyń i mam",
      "Dofinansowanie 80-100% zależnie od województwa",
      "Szkolenie musi być w Bazie Usług Rozwojowych",
      "Wniosek składasz do operatora regionalnego",
    ],
  },
  {
    name: "Powiatowy Urząd Pracy",
    percent: "85%+",
    description:
      "Finansowanie szkoleń dla osób zarejestrowanych jako bezrobotne lub poszukujące pracy.",
    requirements: [
      "Status osoby bezrobotnej lub poszukującej pracy",
      "Rejestracja w powiatowym urzędzie pracy",
      "Uzasadnienie: szkolenie zwiększa szansę na zatrudnienie",
      "Limit zwykle do ok. 300% przeciętnego wynagrodzenia",
    ],
  },
  {
    name: "Krajowy Fundusz Szkoleniowy (KFS)",
    percent: "80-100%",
    description:
      "Dofinansowanie kształcenia pracowników — wniosek składa Twój pracodawca.",
    requirements: [
      "Jesteś zatrudniona na umowę o pracę",
      "Wniosek składa pracodawca do PUP",
      "Mikrofirmy: dofinansowanie do 100%",
      "Pozostałe firmy: do 80% kosztów szkolenia",
    ],
  },
];

const TIMELINE = [
  { title: "Wybierz szkolenie", text: "Przejrzyj katalog i wybierz kurs, który otworzy Ci drzwi do nowej kariery." },
  { title: "Wypełnij formularz", text: "Zostaw kontakt — bezpłatnie sprawdzimy, jaki poziom dofinansowania przysługuje Ci w Twoim województwie." },
  { title: "Bezpłatna konsultacja", text: "Nasza doradczyni omówi z Tobą warunki programu i zbierze potrzebne informacje." },
  { title: "Przygotowanie dokumentów", text: "Pomagamy założyć konto w BUR i przygotować komplet dokumentów do wniosku." },
  { title: "Złożenie wniosku", text: "Wspólnie składamy wniosek do operatora i monitorujemy jego status aż do decyzji." },
  { title: "Rozpoczęcie szkolenia", text: "Po przyznaniu środków zapisujesz się na kurs i zaczynasz naukę — nawet za 0 zł." },
];

const FAQ = [
  {
    question: "Czy muszę być bezrobotna, żeby dostać dofinansowanie?",
    answer:
      "Nie! To najczęstszy mit. Dofinansowania z BUR są dostępne dla osób pracujących, studentek, przedsiębiorczyń i mam na urlopach macierzyńskich. Status bezrobotnej wymagany jest tylko w programach urzędów pracy.",
  },
  {
    question: "Ile wynosi dofinansowanie na szkolenie beauty?",
    answer:
      "W zależności od województwa i programu: od 80% do nawet 100% ceny szkolenia. W wielu przypadkach kursantka nie płaci nic — szkolenie jest w całości pokrywane ze środków europejskich.",
  },
  {
    question: "Jak długo trwa proces uzyskania dofinansowania?",
    answer:
      "Standardowo 2-4 tygodnie od złożenia wniosku do decyzji operatora. Cały proces — od pierwszego kontaktu do rozpoczęcia szkolenia — zamyka się zwykle w 4-6 tygodni.",
  },
  {
    question: "Czy pomagacie w wypełnieniu wniosku?",
    answer:
      "Tak, to nasza specjalność. Prowadzimy Cię przez cały proces: od założenia konta w Bazie Usług Rozwojowych, przez przygotowanie dokumentów, po złożenie wniosku i rozliczenie po szkoleniu. Ty wybierasz kurs — formalności ogarniamy razem.",
  },
  {
    question: "Co jeśli nabór w moim województwie jest zamknięty?",
    answer:
      "Nabory operatorów otwierają się cyklicznie przez cały rok. Zapisujemy Cię na listę i informujemy, gdy tylko ruszy kolejny nabór w Twoim regionie — masz wtedy przewagę nad innymi kandydatkami.",
  },
  {
    question: "Czy dofinansowanie obejmuje kursy online?",
    answer:
      "Tak, większość programów dofinansowuje zarówno szkolenia stacjonarne, jak i online oraz hybrydowe — pod warunkiem, że usługa jest zarejestrowana w BUR.",
  },
];

export default function DofinansowaniaPage() {
  return (
    <div>
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* HERO */}
      <section className="bg-gradient-to-b from-sand-100 via-cream-warm to-cream py-16 text-center md:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mx-auto max-w-3xl">
            <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Dofinansowania", url: "/dofinansowania" }]} />
          </div>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl">
            Szkolenie beauty za <span className="text-money">0 zł</span>? To możliwe!
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Programy dofinansowań pokrywają do 100% ceny certyfikowanych szkoleń. Sprawdź, który program
            pasuje do Twojej sytuacji — i ile możesz zaoszczędzić.
          </p>
          <Link href="/kursy" className="btn-money mt-8">
            Znajdź kurs z dofinansowaniem →
          </Link>
        </div>
      </section>

      {/* PROGRAMY */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6" aria-labelledby="programy-h">
        <h2 id="programy-h" className="text-center text-3xl font-bold md:text-4xl">Programy dofinansowań</h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PROGRAMS.map((p) => (
            <article key={p.name} className="card relative p-6 pt-8">
              <span className="absolute -top-4 right-6 rounded-full bg-money px-4 py-1.5 font-serif text-lg font-bold text-white">
                {p.percent}
              </span>
              <h3 className="font-serif text-xl font-semibold">{p.name}</h3>
              <p className="mt-3 text-sm text-muted">{p.description}</p>
              <ul className="mt-5 space-y-2.5">
                {p.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-sm text-ink">
                    <IconCheck width={16} height={16} className="mt-0.5 shrink-0 text-money" />
                    {r}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* TIMELINE 6 KROKÓW */}
      <section className="bg-cream-warm py-16 md:py-20" aria-labelledby="timeline-h">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 id="timeline-h" className="text-center text-3xl font-bold md:text-4xl">Jak uzyskać dofinansowanie?</h2>
          <ol className="relative mt-14 space-y-8 before:absolute before:left-6 before:top-0 before:h-full before:w-0.5 before:bg-sand-200 md:before:left-1/2">
            {TIMELINE.map((step, i) => (
              <li key={step.title} className={`relative flex md:w-1/2 ${i % 2 ? "md:ml-auto md:pl-12" : "md:pr-12"} pl-16 md:pl-0 ${i % 2 ? "" : "md:pl-0"}`}>
                <span className={`absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full bg-sand-400 font-serif text-lg font-bold text-white md:left-auto ${i % 2 ? "md:-left-6" : "md:-right-6"}`}>
                  {i + 1}
                </span>
                <div className={`card w-full p-5 ${i % 2 ? "md:pl-8" : ""}`}>
                  <h3 className="font-serif text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* KALKULATOR */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:px-6" aria-labelledby="kalkulator-h">
        <h2 id="kalkulator-h" className="text-center text-3xl font-bold md:text-4xl">Kalkulator dofinansowania</h2>
        <p className="mt-3 text-center text-muted">Sprawdź, ile możesz zaoszczędzić na szkoleniu.</p>
        <div className="mt-10">
          <SubsidyCalculator />
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-20 md:px-6" aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-center text-3xl font-bold md:text-4xl">Najczęściej zadawane pytania</h2>
        <div className="mt-10 space-y-3">
          {FAQ.map((item) => (
            <details key={item.question} className="card group p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
                {item.question}
                <IconChevronDown className="shrink-0 text-sand-500 transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/konsultacja" className="btn-primary">Umów bezpłatną konsultację</Link>
        </div>
      </section>
    </div>
  );
}
