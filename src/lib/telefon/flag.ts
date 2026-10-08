/**
 * Telefon admina (SMS przez dedykowany telefon UB + dziennik rozmów) jest zbudowany,
 * ale WYŁĄCZONY do czasu świadomego włączenia: zmienna `TELEFON_ENABLED=true` w Coolify
 * + wgranie nowej wersji. Bez niej zakładka nie pokazuje się w menu, strona zwraca 404,
 * a trasy API odpowiadają 404.
 */
export function telefonEnabled(): boolean {
  return process.env.TELEFON_ENABLED === "true";
}
