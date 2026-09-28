/**
 * Produkty cyfrowe sprzedawane przez UB (płatność i dostarczenie pliku: naffy, sklep naffy.io/uniwersytetbeauty).
 *
 * `checkoutUrl` pusty = sprzedaż jeszcze nie ruszyła. Wtedy strona produktu:
 * - ma `robots: noindex` i nie trafia do sitemapy,
 * - zamiast przycisku zakupu pokazuje informację o starcie sprzedaży (bez martwego linku).
 * Wklejenie linku z naffy + deploy = strona sprzedaje i się indeksuje. Nic więcej nie trzeba.
 *
 * Plik PDF NIE leży w `public/` — w `public/poradniki/wlasny-salon/` są wyłącznie podglądy stron.
 * Źródło i generator PDF: vault Sejf, `firmy/uniwersytet-beauty/produkty/poradnik-wlasny-salon/`.
 */
export const PORADNIK_SALON = {
  slug: "poradnik-wlasny-salon",
  tytul: "Własny salon beauty",
  podtytul: "Od otwarcia do pełnego grafiku",
  /** Cena brutto w zł; musi być identyczna jak w naffy. Sprzedawca zwolniony z VAT. */
  cena: 49,
  strony: 36,
  checkoutUrl: "",
} as const;

export const PORADNIK_SALON_W_SPRZEDAZY = PORADNIK_SALON.checkoutUrl.length > 0;
