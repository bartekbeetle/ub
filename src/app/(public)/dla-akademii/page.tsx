import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { IconCheck } from "@/components/icons";
import { SITE_NAME, SUBSIDY_CONDITION } from "@/lib/constants";

/**
 * Strona ofertowa dla AKADEMII I TRENEREK (B2B) — druga, osobna publiczność serwisu.
 *
 * ⚠️ CELOWO NIE MA TU ANI JEDNEJ STAWKI.
 * Cena podana pierwszej akademii jest precedensem dla wszystkich następnych, a wybór między
 * modelem „za zapisaną kursantkę” a pilotażem bez opłat jest decyzją właściciela, nie stroną WWW.
 * Strona mówi więc wyłącznie to, co prawdziwe w obu wariantach: nie bierzemy opłaty wstępnej,
 * nie bierzemy prowizji od pracy trenerki, a zasady rozliczenia ustalamy w rozmowie przed umową.
 * Gdy stawka zostanie zatwierdzona — wchodzi tutaj jedną sekcją, nie przepisaniem strony.
 */

const TITLE = "Dla akademii i trenerek — kursantki z dofinansowaniem BUR";
const DESCRIPTION =
  "Zgłaszamy do Twojej akademii kobiety, które chcą się szkolić z dofinansowaniem z Bazy Usług Rozwojowych. Załóż konto, my robimy reklamę i kwalifikację.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/dla-akademii" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/dla-akademii",
    type: "website",
    locale: "pl_PL",
    siteName: SITE_NAME,
  },
};

const STEPS = [
  {
    title: "Zakładasz konto",
    body: "Formularz na trzy minuty: nazwa akademii, region, zakres szkoleń, wpis do BUR. Bez opłaty wstępnej i bez abonamentu.",
  },
  {
    title: "Weryfikujemy wpis do BUR",
    body: "Sprawdzamy Twoją kartę dostawcy w rejestrze PARP. Bez wpisu kursantka nie rozliczy dofinansowania — dlatego robimy to przed przekazaniem pierwszego kontaktu.",
  },
  {
    title: "Dzwonimy i podpisujemy umowę",
    body: "Ustalamy zakres, region i zasady rozliczenia. Dane kontaktowe kursantek wolno nam przekazać dopiero po umowie — tak wymaga RODO.",
  },
  {
    title: "Dostajesz zgłoszenia kursantek",
    body: "Kobiety z Twojego regionu i Twojej kategorii, po wypełnieniu formularza kwalifikacyjnego, trafiają do panelu. Dzwonisz i zapisujesz.",
  },
];

const FOR_YOU = [
  "Prowadzisz szkolenia beauty — PMU, brwi, rzęsy, paznokcie, kosmetologia, medycyna estetyczna.",
  "Masz wpis do Bazy Usług Rozwojowych albo jesteś w trakcie jego uzyskiwania.",
  "Masz wolne miejsca na najbliższych terminach i chcesz je zapełnić teraz, nie „kiedyś”.",
  "Marketing własny zjada Ci czas i budżet bez gwarancji, że ktoś się zapisze.",
];

const FAQ = [
  {
    q: "Ile to kosztuje?",
    a: "Nie pobieramy opłaty wstępnej, abonamentu ani prowizji od Twojej pracy z kursantką. Zasady rozliczenia ustalamy w rozmowie telefonicznej i zapisujemy w umowie — zanim przekażemy Ci pierwszy kontakt. Żadna opłata nie pojawia się bez Twojego podpisu.",
  },
  {
    q: "Nie mam wpisu do BUR. Mogę się zgłosić?",
    a: "Tak. Zaznacz to w formularzu. Kursantki z dofinansowaniem obsługują wyłącznie podmioty z wpisem, ale dla akademii bez wpisu mamy osobną ścieżkę — porozmawiamy o niej przez telefon.",
  },
  {
    q: "Skąd biorą się kursantki?",
    a: `Z naszych reklam i treści. Docieramy do kobiet, które nie wiedzą, że dofinansowanie z BUR (${SUBSIDY_CONDITION}) należy się również pracującym, studentkom, mamom na macierzyńskim i przedsiębiorczyniom — nie tylko osobom bezrobotnym. Każda wypełnia formularz kwalifikacyjny, zanim trafi do akademii.`,
  },
  {
    q: "Czy dostaję dane osobowe kursantki od razu?",
    a: "Nie. Przed podpisaniem umowy partnerskiej widzisz wyłącznie własne dane w panelu. Kontakt do kursantki przekazujemy dopiero wtedy, gdy mamy do tego podstawę prawną. To nie jest formalność — to warunek, żeby cała ta współpraca była legalna.",
  },
];

export default function DlaAkademiiPage() {
  return (
    <div className="bg-gradient-to-b from-sand-100 via-cream-warm to-cream">
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
        <Breadcrumbs
          items={[
            { name: "Strona główna", url: "/" },
            { name: "Dla akademii", url: "/dla-akademii" },
          ]}
        />

        <header className="mt-6 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-money-dark">Współpraca B2B</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
            Kursantki z dofinansowaniem — <span className="text-money">wprost do Twojego kalendarza</span>
          </h1>
          <p className="mt-5 text-lg text-muted">
            Prowadzimy reklamę i kwalifikację, Ty prowadzisz szkolenia. Zgłaszają się do nas kobiety, które chcą się
            uczyć zawodu beauty i mogą sfinansować kurs z Bazy Usług Rozwojowych. Szukamy dla nich akademii — w ich
            mieście, w ich kategorii.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/dla-akademii/rejestracja" className="btn-primary">
              Załóż konto akademii
            </Link>
            <Link href="/panel/login" className="btn-outline">
              Mam już konto
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            Założenie konta nie jest zobowiązaniem. Żadna opłata nie pojawia się bez podpisanej umowy.
          </p>
        </header>

        <section className="mt-16">
          <h2 className="font-serif text-2xl font-bold">Jak to działa</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-6">
                <span className="font-serif text-3xl font-bold text-sand-500">{i + 1}</span>
                <h3 className="mt-2 font-serif text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-2xl font-bold">To jest dla Ciebie, jeśli</h2>
            <ul className="mt-6 space-y-4">
              {FOR_YOU.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <IconCheck width={20} height={20} className="mt-0.5 shrink-0 text-money" />
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6 md:p-8">
            <h2 className="font-serif text-xl font-bold">Co dostajesz w panelu</h2>
            <ul className="mt-4 space-y-3 text-sm text-ink">
              <li>Zgłoszenia kursantek z Twojego regionu i kategorii — z notatką z kwalifikacji.</li>
              <li>Status każdej kursantki: skontaktowana, zapisana, odrzucona wraz z powodem.</li>
              <li>Rozliczenia — komplet tego, co się nam należy, bez wymiany maili.</li>
              <li>Profil akademii, z którego korzystamy przy dobieraniu zgłoszeń.</li>
            </ul>
            <p className="mt-5 text-xs text-muted">
              Dane kontaktowe kursantek pojawiają się w panelu dopiero po podpisaniu umowy partnerskiej.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-2xl font-bold">Najczęstsze pytania</h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="card p-6">
                <dt className="font-serif text-lg font-semibold">{item.q}</dt>
                <dd className="mt-2 text-sm text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card mt-16 p-8 text-center">
          <h2 className="font-serif text-2xl font-bold">Zacznij od konta — rozmowa jest później</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Wypełnienie formularza zajmuje trzy minuty i niczego nie przesądza. Oddzwonimy zwykle w ciągu 1–2 dni
            roboczych i dopiero wtedy ustalimy konkrety.
          </p>
          <Link href="/dla-akademii/rejestracja" className="btn-primary mt-6 inline-block">
            Załóż konto akademii
          </Link>
        </section>
      </div>
    </div>
  );
}
