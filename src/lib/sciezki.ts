/**
 * Ścieżki kariery — kolejność kursów w danej specjalizacji (wzorzec: „Zaplanuj ścieżkę kariery").
 *
 * Krok = grupa kursów do wyboru. Tytuły i opisy kursów NIE są tu duplikowane — strona bierze je
 * z bazy po `slug`, więc nie rozjadą się z kartą kursu. Tu siedzi tylko kolejność i krótkie
 * wprowadzenie do kroku (bez godzin, cen i obietnic — patrz feedback „opisy kursów bez zmyśleń").
 *
 * Kolejność wynika z poziomów, które same kursy deklarują w opisach (podstawowy → „dla osób
 * z praktyką" → masterclass). Do potwierdzenia z akademią, zanim ścieżka pójdzie na produkcję.
 */

export type KrokSciezki = {
  tytul: string;
  wprowadzenie: string;
  /** Slugi kursów z bazy; krok pomija kursy, których nie ma (np. nieopublikowane). */
  kursy: string[];
};

export type Sciezka = {
  slug: string;
  nazwa: string;
  naglowek: string;
  lead: string;
  /** Kategoria z CATEGORIES — do linku „wszystkie kursy". */
  kategoria: string;
  kroki: KrokSciezki[];
};

export const SCIEZKI: Sciezka[] = [
  {
    slug: "makijaz-permanentny",
    nazwa: "Makijaż permanentny",
    naglowek: "Ścieżka kariery w makijażu permanentnym",
    lead: "Makijaż permanentny to zawód, w którym zarabia się na kolejnych technikach, nie na jednym kursie. Poniżej kolejność, którą widać po poziomach samych szkoleń — od startu, przez usta i kreskę, po masterclassy i korekty.",
    kategoria: "PMU / Makijaż permanentny",
    kroki: [
      {
        tytul: "Wejście w PMU",
        wprowadzenie: "Zaczynasz od brwi — najczęściej zamawianej partii twarzy. Wybierz jeden pakiet startowy albo jedną technikę.",
        kursy: ["wk-basic-pmu-brwi-usta-kreska", "wk-brwi-microblading-basic", "wk-brwi-ombre-basic"],
      },
      {
        tytul: "Usta i kreska",
        wprowadzenie: "Dwie kolejne partie, które poszerzają ofertę salonu o zabiegi poza brwiami.",
        kursy: ["wk-usta-basic", "wk-kreski-basic"],
      },
      {
        tytul: "Kolejna technika brwi",
        wprowadzenie: "Gdy masz już praktykę, dokładasz technikę pośrednią między microbladingiem a ombre.",
        kursy: ["wk-wlos-maszynowy"],
      },
      {
        tytul: "Masterclass — trudniejsze przypadki",
        wprowadzenie: "Szkolenia dla osób z praktyką: korekty, blizny, asymetria, precyzja linii. Wybierz kierunek, w którym chcesz być najlepsza.",
        kursy: [
          "wk-masterclass-brwi-ombre",
          "wk-masterclass-usta",
          "wk-masterclass-kreski-cieniowane",
          "wk-masterclass-eyeliner-klasyczny",
        ],
      },
      {
        tytul: "Korekty i usuwanie pigmentu",
        wprowadzenie: "Naprawianie cudzych zabiegów to osobna specjalizacja — dla osób z doświadczeniem w pigmentacji.",
        kursy: ["wk-usuwanie-laserowe"],
      },
    ],
  },
];

export function getSciezka(slug: string): Sciezka | undefined {
  return SCIEZKI.find((s) => s.slug === slug);
}
