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
  /** Poziom cen szkoleń w mieście. Realnie różnicuje treść — w metropolii stawki stoją przy górnej granicy widełek. */
  tier: "metropolia" | "duze" | "mniejsze";
  /** Poziom dofinansowania POTWIERDZONY dla województwa (kanon F1/F2, gotowe zdanie do wstawienia
   *  w sekcję "Dofinansowanie w województwie..."). Pusty string = nie mamy potwierdzonej liczby
   *  dla tego województwa — generator wstawia wtedy zdanie odsyłające do regulaminu operatora,
   *  zamiast zgadywać (zasada z kanonu §7: nie zmyślamy liczb bez źródła). */
  poziomDofinansowania: string;
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
    tier: "metropolia",
    poziomDofinansowania:
      "Potwierdzone nabory dla osób dorosłych w województwie mazowieckim sięgają nawet 95% ceny, z limitem kwotowym w przedziale 6 100-14 900 zł na osobę: dokładny poziom ustala regulamin konkretnego naboru.",
  },
  {
    slug: "krakow",
    nazwa: "Kraków",
    wMiescie: "w Krakowie",
    dopelniacz: "Krakowa",
    wojewodztwo: "małopolskie",
    wWojewodztwie: "w województwie małopolskim",
    okolica: ["Wieliczka", "Skawina", "Niepołomice", "Wadowice"],
    tier: "metropolia",
    poziomDofinansowania: "",
  },
  {
    slug: "wroclaw",
    nazwa: "Wrocław",
    wMiescie: "we Wrocławiu",
    dopelniacz: "Wrocławia",
    wojewodztwo: "dolnośląskie",
    wWojewodztwie: "w województwie dolnośląskim",
    okolica: ["Oleśnica", "Oława", "Trzebnica", "Środa Śląska"],
    tier: "duze",
    poziomDofinansowania:
      "Poziom dofinansowania i limit kwotowy na osobę w województwie dolnośląskim ustala regulamin konkretnego naboru operatora regionalnego.",
  },
  {
    slug: "poznan",
    nazwa: "Poznań",
    wMiescie: "w Poznaniu",
    dopelniacz: "Poznania",
    wojewodztwo: "wielkopolskie",
    wWojewodztwie: "w województwie wielkopolskim",
    okolica: ["Swarzędz", "Luboń", "Środa Wielkopolska", "Oborniki"],
    tier: "duze",
    poziomDofinansowania:
      "Operatorzy w województwie wielkopolskim stosują limit kwotowy w przedziale 4 522-10 000 zł na osobę; poziom dofinansowania ustala regulamin konkretnego naboru.",
  },
  {
    slug: "gdansk",
    nazwa: "Gdańsk",
    wMiescie: "w Gdańsku",
    dopelniacz: "Gdańska",
    wojewodztwo: "pomorskie",
    wWojewodztwie: "w województwie pomorskim",
    okolica: ["Gdynia", "Sopot", "Tczew", "Pruszcz Gdański"],
    tier: "duze",
    poziomDofinansowania: "",
  },
  {
    slug: "lodz",
    nazwa: "Łódź",
    wMiescie: "w Łodzi",
    dopelniacz: "Łodzi",
    wojewodztwo: "łódzkie",
    wWojewodztwie: "w województwie łódzkim",
    okolica: ["Pabianice", "Zgierz", "Aleksandrów Łódzki", "Konstantynów Łódzki"],
    tier: "duze",
    poziomDofinansowania:
      "Poziom dofinansowania i limit kwotowy na osobę w województwie łódzkim ustala regulamin konkretnego naboru operatora regionalnego.",
  },
  {
    slug: "lublin",
    nazwa: "Lublin",
    wMiescie: "w Lublinie",
    dopelniacz: "Lublina",
    wojewodztwo: "lubelskie",
    wWojewodztwie: "w województwie lubelskim",
    okolica: ["Świdnik", "Lubartów", "Puławy", "Kraśnik"],
    tier: "duze",
    poziomDofinansowania: "",
  },
  {
    slug: "katowice",
    nazwa: "Katowice",
    wMiescie: "w Katowicach",
    dopelniacz: "Katowic",
    wojewodztwo: "śląskie",
    wWojewodztwie: "w województwie śląskim",
    okolica: ["Sosnowiec", "Chorzów", "Tychy", "Gliwice", "Zabrze"],
    tier: "duze",
    poziomDofinansowania:
      "Potwierdzone nabory dla osób dorosłych w województwie śląskim obejmują nawet 95% ceny, z limitem kwotowym 5 000 zł na osobę: to jeden z najkorzystniejszych poziomów w kraju.",
  },
  {
    slug: "szczecin",
    nazwa: "Szczecin",
    wMiescie: "w Szczecinie",
    dopelniacz: "Szczecina",
    wojewodztwo: "zachodniopomorskie",
    wWojewodztwie: "w województwie zachodniopomorskim",
    okolica: ["Police", "Stargard", "Goleniów", "Gryfino"],
    tier: "duze",
    poziomDofinansowania: "",
  },
  {
    slug: "gdynia",
    nazwa: "Gdynia",
    wMiescie: "w Gdyni",
    dopelniacz: "Gdyni",
    wojewodztwo: "pomorskie",
    wWojewodztwie: "w województwie pomorskim",
    okolica: ["Gdańsk", "Sopot", "Rumia", "Wejherowo"],
    tier: "duze",
    poziomDofinansowania: "",
  },
  {
    slug: "opole",
    nazwa: "Opole",
    wMiescie: "w Opolu",
    dopelniacz: "Opola",
    wojewodztwo: "opolskie",
    wWojewodztwie: "w województwie opolskim",
    okolica: ["Kędzierzyn-Koźle", "Brzeg", "Krapkowice", "Strzelce Opolskie"],
    tier: "mniejsze",
    poziomDofinansowania: "",
  },
  {
    slug: "legnica",
    nazwa: "Legnica",
    wMiescie: "w Legnicy",
    dopelniacz: "Legnicy",
    wojewodztwo: "dolnośląskie",
    wWojewodztwie: "w województwie dolnośląskim",
    okolica: ["Lubin", "Głogów", "Jawor", "Chojnów"],
    tier: "mniejsze",
    poziomDofinansowania:
      "Poziom dofinansowania i limit kwotowy na osobę w województwie dolnośląskim ustala regulamin konkretnego naboru operatora regionalnego.",
  },
  {
    slug: "plock",
    nazwa: "Płock",
    wMiescie: "w Płocku",
    dopelniacz: "Płocka",
    wojewodztwo: "mazowieckie",
    wWojewodztwie: "w województwie mazowieckim",
    okolica: ["Gostynin", "Sierpc", "Płońsk", "Wyszogród"],
    tier: "mniejsze",
    poziomDofinansowania:
      "Potwierdzone nabory dla osób dorosłych w województwie mazowieckim sięgają nawet 95% ceny, z limitem kwotowym w przedziale 6 100-14 900 zł na osobę: dokładny poziom ustala regulamin konkretnego naboru.",
  },
];

export const LOKALIZACJA_PO_SLUGU = new Map(LOKALIZACJE.map((l) => [l.slug, l]));
