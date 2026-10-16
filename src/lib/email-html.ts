/**
 * Część HTML maila ze śledzeniem (16.10.2026). Bez `server-only` — testowalne skryptem.
 *
 * Treść maili dalej piszemy jako zwykły tekst (to jest źródło prawdy i to widzi podgląd).
 * HTML powstaje z tekstu mechanicznie: escapowanie, akapity, linki przez `/api/t/c/<token>`
 * i piksel `/api/t/o/<token>`. Część tekstowa wychodzi obok bez zmian — klient, który nie
 * pokazuje HTML, dostaje dokładnie to, co dziś.
 */

/** Rodzaje maili, które śledzimy. Wewnętrzne i korespondencja 1:1 trenerki — nie. */
export const TRACKED_KINDS = new Set([
  "kursantka_potwierdzenie",
  "kursantka_zapis",
  "trenerka_lead",
  "porzucona_aplikacja",
  "akademia_powitanie",
  "marketing",
]);

export function isTrackedKind(kind: string | null | undefined): boolean {
  return TRACKED_KINDS.has((kind ?? "").split(":")[0]);
}

const URL_RE = /https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?]/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Linków wypisania nie owijamy: klik „wypisz” nie jest zaangażowaniem i ma działać bez naszego serwera pośrodku. */
function shouldWrap(url: string): boolean {
  return !/\/wypisz|\/api\/wypisz/.test(url);
}

export function buildTrackedHtml(text: string, opts: { siteUrl: string; token: string }): string {
  const base = opts.siteUrl.replace(/\/$/, "");
  const linkify = (escaped: string) =>
    escaped.replace(URL_RE, (url) => {
      // `url` jest już po escapowaniu (`&amp;`) — do parametru bierzemy wersję surową.
      const raw = url.replace(/&amp;/g, "&");
      const href = shouldWrap(raw) ? `${base}/api/t/c/${opts.token}?u=${encodeURIComponent(raw)}` : raw;
      return `<a href="${escapeHtml(href)}" style="color:#8a6a2f">${url}</a>`;
    });

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linkify(escapeHtml(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return (
    `<!doctype html><html lang="pl"><body style="margin:0;padding:24px;background:#ffffff">` +
    `<div style="max-width:600px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#2b2b2b">` +
    paragraphs +
    `</div>` +
    `<img src="${base}/api/t/o/${opts.token}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">` +
    `</body></html>`
  );
}

/** Czy `url` z linku śledzącego naprawdę występuje w treści maila — bez tego endpoint byłby otwartym przekierowaniem. */
export function urlInBody(url: string, body: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  return (body.match(URL_RE) ?? ([] as string[])).includes(url);
}
