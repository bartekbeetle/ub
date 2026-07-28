/**
 * Zweryfikowane frazy kluczowe = JEDYNE źródło prawdy o tym, które strony wolno wygenerować.
 *
 * ZASADA MASZYNY (anty-doorway): strona kategoria × miasto powstaje TYLKO wtedy, gdy stoi za nią
 * fraza z realnym wolumenem z narzędzia zewnętrznego. Nie generujemy „na wszelki wypadek"
 * kombinacji 16 województw × 8 kategorii — to jest dokładnie wzorzec stron-wrót, za który
 * Google karze, i to samo, co już raz wytknęliśmy sobie przy `/kursy?kategoria=...`.
 *
 * Źródło: OpenSEO / DataForSEO, lokalizacja 2616 (Polska), język pl, pobrane 2026-07-28.
 * Wolumen = średnia miesięczna z 12 miesięcy. Odświeżać co kwartał — trendy w tabeli pokazują
 * wyraźną sezonowość (szczyt styczeń i wakacje).
 */

export type Fraza = {
  /** Dokładna fraza z narzędzia. */
  fraza: string;
  kategoria: string;
  lokalizacja: string;
  wolumen: number;
  zrodlo: "openseo-2026-07-28";
};

export const FRAZY: Fraza[] = [
  // ── Stylizacja paznokci (kategoria o największym popycie: rdzeń 1900/mies.) ──
  { fraza: "kurs stylizacji paznokci warszawa", kategoria: "stylizacja-paznokci", lokalizacja: "warszawa", wolumen: 210, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs stylizacji paznokci wrocław", kategoria: "stylizacja-paznokci", lokalizacja: "wroclaw", wolumen: 140, zrodlo: "openseo-2026-07-28" },
  { fraza: "bezpłatny kurs stylizacji paznokci poznań", kategoria: "stylizacja-paznokci", lokalizacja: "poznan", wolumen: 30, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs stylizacji paznokci legnica", kategoria: "stylizacja-paznokci", lokalizacja: "legnica", wolumen: 30, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs stylizacji paznokci płock", kategoria: "stylizacja-paznokci", lokalizacja: "plock", wolumen: 30, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs stylizacji paznokci dla początkujących łódź", kategoria: "stylizacja-paznokci", lokalizacja: "lodz", wolumen: 20, zrodlo: "openseo-2026-07-28" },

  // ── Przedłużanie i stylizacja rzęs ──
  { fraza: "kurs przedłużania rzęs wrocław", kategoria: "przedluzanie-rzes", lokalizacja: "wroclaw", wolumen: 110, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs przedłużania rzęs warszawa", kategoria: "przedluzanie-rzes", lokalizacja: "warszawa", wolumen: 110, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs przedłużania rzęs kraków", kategoria: "przedluzanie-rzes", lokalizacja: "krakow", wolumen: 90, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs przedłużania rzęs poznań", kategoria: "przedluzanie-rzes", lokalizacja: "poznan", wolumen: 70, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs przedłużania rzęs lublin", kategoria: "przedluzanie-rzes", lokalizacja: "lublin", wolumen: 40, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs przedłużania rzęs gdańsk", kategoria: "przedluzanie-rzes", lokalizacja: "gdansk", wolumen: 40, zrodlo: "openseo-2026-07-28" },

  // ── Makijaż permanentny (PMU) ──
  { fraza: "szkolenie makijaż permanentny warszawa", kategoria: "makijaz-permanentny", lokalizacja: "warszawa", wolumen: 90, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs makijażu permanentnego wrocław", kategoria: "makijaz-permanentny", lokalizacja: "wroclaw", wolumen: 50, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs makijażu permanentnego poznań", kategoria: "makijaz-permanentny", lokalizacja: "poznan", wolumen: 30, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs makijażu permanentnego kraków", kategoria: "makijaz-permanentny", lokalizacja: "krakow", wolumen: 20, zrodlo: "openseo-2026-07-28" },

  // ── Laminacja brwi i rzęs ──
  { fraza: "kurs laminacji brwi i rzęs warszawa", kategoria: "laminacja-brwi-rzes", lokalizacja: "warszawa", wolumen: 50, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs laminacji brwi i rzęs kraków", kategoria: "laminacja-brwi-rzes", lokalizacja: "krakow", wolumen: 40, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs laminacji brwi i rzęs gdańsk", kategoria: "laminacja-brwi-rzes", lokalizacja: "gdansk", wolumen: 20, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs laminacji brwi i rzęs lublin", kategoria: "laminacja-brwi-rzes", lokalizacja: "lublin", wolumen: 20, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs laminacji brwi i rzęs katowice", kategoria: "laminacja-brwi-rzes", lokalizacja: "katowice", wolumen: 20, zrodlo: "openseo-2026-07-28" },

  // Poniżej progu w pierwszym batchu — zostają w danych, żeby dało się obniżyć próg bez researchu.
  { fraza: "kurs przedłużania rzęs opole", kategoria: "przedluzanie-rzes", lokalizacja: "opole", wolumen: 10, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs przedłużania rzęs gdynia", kategoria: "przedluzanie-rzes", lokalizacja: "gdynia", wolumen: 10, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs makijażu permanentnego łódź", kategoria: "makijaz-permanentny", lokalizacja: "lodz", wolumen: 10, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs makijażu permanentnego lublin", kategoria: "makijaz-permanentny", lokalizacja: "lublin", wolumen: 10, zrodlo: "openseo-2026-07-28" },
  { fraza: "szkolenie makijaż permanentny szczecin", kategoria: "makijaz-permanentny", lokalizacja: "szczecin", wolumen: 10, zrodlo: "openseo-2026-07-28" },
  { fraza: "kurs laminacji brwi i rzęs łódź", kategoria: "laminacja-brwi-rzes", lokalizacja: "lodz", wolumen: 10, zrodlo: "openseo-2026-07-28" },
];

/** Próg wolumenu dla batcha. Podnieś, żeby zawęzić; obniż, żeby zejść głębiej w long tail. */
export const PROG_WOLUMENU = 20;
