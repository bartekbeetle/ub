/**
 * Numer rozmówcy → E.164. Łagodniejszy niż `normalizePlPhone`: odpowiedź może przyjść
 * od numeru zagranicznego albo bez plusa ("48500600700"), a odebrany SMS nie wolno zgubić.
 */
export function normalizeAnyPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[\s\-().]/g, "");
  if (!/^\+?\d{6,15}$/.test(d)) return null;
  if (d.startsWith("+")) return d;
  if (d.startsWith("00")) return `+${d.slice(2)}`;
  if (d.length === 9) return `+48${d}`;
  return `+${d}`;
}

/** „+48500600700" → „500 600 700" dla numerów polskich; reszta bez zmian. */
export function formatPhone(e164: string): string {
  const m = /^\+48(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : e164;
}
