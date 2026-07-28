/**
 * Lokalizacje pod content geo-SEO.
 *
 * `wMiescie` trzymamy jako GOTOWĄ frazę z przyimkiem, a nie sklejamy „w " + nazwa.
 * Powód: polska odmiana. „w Warszawie", ale „we Wrocławiu" i „w Łodzi" — sklejanie
 * produkuje „w Warszawa", co natychmiast zdradza generator i psuje wiarygodność tekstu.
 */

export type Lokalizacja = {
  slug: string;
  nazwa: string;
  /** Miejscownik z przyimkiem: „w Warszawie", „we Wrocławiu". */
  wMiescie: string;
  /** Dopełniacz: „Warszawy", „Wrocławia" — do konstrukcji „mieszkanki Warszawy". */
  dopelniacz: string;
  wojewodztwo: string;
  /** Miejscownik województwa z przyimkiem: „w województwie mazowieckim". */
  wWojewodztwie: string;
  /** Realne miasta w zasięgu dojazdu — materiał na sekcję lokalną, nie ozdobnik. */
  okolica: string[];
};

export const LOKALIZACJE: Lokalizacja[] = [
  {
    slug: "warszawa",
    nazwa: "Warszawa",
    wMiescie: "w Warszawie",
    dopelniacz: "Warszawy",
    wojewodztwo: "mazowieckie",
    wWojewodztwie: "w województwie mazowieckim",
    okolica: ["Pruszków", "Piaseczno", "Legionowo", "Otwock", "Wołomin"],
  },
  {
    slug: "krakow",
    nazwa: "Kraków",
    wMiescie: "w Krakowie",
    dopelniacz: "Krakowa",
    wojewodztwo: "małopolskie",
    wWojewodztwie: "w województwie małopolskim",
    okolica: ["Wieliczka", "Skawina", "Niepołomice", "Wadowice"],
  },
  {
    slug: "wroclaw",
    nazwa: "Wrocław",
    wMiescie: "we Wrocławiu",
    dopelniacz: "Wrocławia",
    wojewodztwo: "dolnośląskie",
    wWojewodztwie: "w województwie dolnośląskim",
    okolica: ["Oleśnica", "Oława", "Trzebnica", "Środa Śląska"],
  },
  {
    slug: "poznan",
    nazwa: "Poznań",
    wMiescie: "w Poznaniu",
    dopelniacz: "Poznania",
    wojewodztwo: "wielkopolskie",
    wWojewodztwie: "w województwie wielkopolskim",
    okolica: ["Swarzędz", "Luboń", "Środa Wielkopolska", "Oborniki"],
  },
  {
    slug: "gdansk",
    nazwa: "Gdańsk",
    wMiescie: "w Gdańsku",
    dopelniacz: "Gdańska",
    wojewodztwo: "pomorskie",
    wWojewodztwie: "w województwie pomorskim",
    okolica: ["Gdynia", "Sopot", "Tczew", "Pruszcz Gdański"],
  },
  {
    slug: "lodz",
    nazwa: "Łódź",
    wMiescie: "w Łodzi",
    dopelniacz: "Łodzi",
    wojewodztwo: "łódzkie",
    wWojewodztwie: "w województwie łódzkim",
    okolica: ["Pabianice", "Zgierz", "Aleksandrów Łódzki", "Konstantynów Łódzki"],
  },
  {
    slug: "lublin",
    nazwa: "Lublin",
    wMiescie: "w Lublinie",
    dopelniacz: "Lublina",
    wojewodztwo: "lubelskie",
    wWojewodztwie: "w województwie lubelskim",
    okolica: ["Świdnik", "Lubartów", "Puławy", "Kraśnik"],
  },
  {
    slug: "katowice",
    nazwa: "Katowice",
    wMiescie: "w Katowicach",
    dopelniacz: "Katowic",
    wojewodztwo: "śląskie",
    wWojewodztwie: "w województwie śląskim",
    okolica: ["Sosnowiec", "Chorzów", "Tychy", "Gliwice", "Zabrze"],
  },
  {
    slug: "szczecin",
    nazwa: "Szczecin",
    wMiescie: "w Szczecinie",
    dopelniacz: "Szczecina",
    wojewodztwo: "zachodniopomorskie",
    wWojewodztwie: "w województwie zachodniopomorskim",
    okolica: ["Police", "Stargard", "Goleniów", "Gryfino"],
  },
  {
    slug: "gdynia",
    nazwa: "Gdynia",
    wMiescie: "w Gdyni",
    dopelniacz: "Gdyni",
    wojewodztwo: "pomorskie",
    wWojewodztwie: "w województwie pomorskim",
    okolica: ["Gdańsk", "Sopot", "Rumia", "Wejherowo"],
  },
  {
    slug: "opole",
    nazwa: "Opole",
    wMiescie: "w Opolu",
    dopelniacz: "Opola",
    wojewodztwo: "opolskie",
    wWojewodztwie: "w województwie opolskim",
    okolica: ["Kędzierzyn-Koźle", "Brzeg", "Krapkowice", "Strzelce Opolskie"],
  },
  {
    slug: "legnica",
    nazwa: "Legnica",
    wMiescie: "w Legnicy",
    dopelniacz: "Legnicy",
    wojewodztwo: "dolnośląskie",
    wWojewodztwie: "w województwie dolnośląskim",
    okolica: ["Lubin", "Głogów", "Jawor", "Chojnów"],
  },
  {
    slug: "plock",
    nazwa: "Płock",
    wMiescie: "w Płocku",
    dopelniacz: "Płocka",
    wojewodztwo: "mazowieckie",
    wWojewodztwie: "w województwie mazowieckim",
    okolica: ["Gostynin", "Sierpc", "Płońsk", "Wyszogród"],
  },
];

export const LOKALIZACJA_PO_SLUGU = new Map(LOKALIZACJE.map((l) => [l.slug, l]));
