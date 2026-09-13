import { permanentRedirect } from "next/navigation";

/**
 * Decyzja właściciela (13.09.2026, start kampanii płatnej): publicznie CHOWAMY trenerki.
 * Cały ruch ma iść w jeden lejek — quiz kwalifikacyjny. Profile trenerek zostają w bazie
 * nietknięte (dane, umowy, rozliczenia bez zmian), znika tylko publiczna witryna.
 *
 * 308 (permanent), nie 404 — adres jest zaindeksowany w Google od tygodni, a listing
 * kursów pod tym samym adresem semantycznie zastępuje katalog trenerek.
 */
export default function TrenerkiPage(): never {
  permanentRedirect("/kursy");
}
