import { permanentRedirect } from "next/navigation";

/**
 * Decyzja właściciela (13.09.2026, start kampanii płatnej): publicznie CHOWAMY trenerki.
 * Cały ruch ma iść w jeden lejek — quiz kwalifikacyjny. Profil w bazie zostaje nietknięty
 * (dane, umowa, rozliczenia bez zmian), znika tylko publiczna podstrona.
 *
 * 308 (permanent), nie 404 — pojedyncze profile trenerek są zaindeksowane w Google.
 * Bez `slug` w treści przekierowania celowo: nie chcemy warunkować trasy po istnieniu
 * rekordu w bazie (dodatkowe zapytanie tylko po to, żeby wybrać 404 albo redirect —
 * i tak każdy adres pod /trenerka/* ma dziś iść w jedno miejsce).
 */
export default function TrenerkaPage(): never {
  permanentRedirect("/kursy");
}
