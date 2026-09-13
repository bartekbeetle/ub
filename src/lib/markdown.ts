import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Markdown -> bezpieczny HTML (sanityzacja XSS) */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: [
      "h2", "h3", "h4", "p", "a", "ul", "ol", "li", "strong", "em", "blockquote",
      "code", "pre", "table", "thead", "tbody", "tr", "th", "td", "img", "hr", "br",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "width", "height", "loading"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
    },
    allowedSchemes: ["https", "http", "mailto"],
  });
}

/**
 * Dzieli sanityzowany HTML artykułu na dwie połowy w najbliższym bezpiecznym miejscu
 * granicy bloku (koniec akapitu/listy/cytatu albo przed kolejnym `<h2>`), możliwie blisko
 * połowy długości tekstu. Używane do wstrzyknięcia CTA W ŚRODKU artykułu bloga
 * (`src/app/(public)/blog/[slug]/page.tsx`) bez rozcinania znaczników.
 *
 * Zwraca `[html, ""]`, gdy nie znaleziono żadnej sensownej granicy (bardzo krótki wpis) —
 * strona wtedy renderuje CTA tylko na końcu, nie zostawia pustego drugiego bloku.
 */
export function splitHtmlAtMidpoint(html: string): [string, string] {
  const target = html.length / 2;
  // Kandydaci na cięcie: tuż po zamknięciu bloku, albo tuż przed nowym h2 (koniec sekcji).
  const boundary = /<\/(?:p|ul|ol|blockquote|table)>|(?=<h2)/g;
  let best: number | null = null;
  let bestDist = Infinity;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(html))) {
    const pos = m[0].startsWith("</") ? m.index + m[0].length : m.index;
    // Dopasowanie `(?=<h2)` jest zero-length — bez ręcznego przesunięcia `lastIndex`
    // regex z flagą `g` zapętliłby się w nieskończoność na tym samym miejscu.
    if (m[0].length === 0) boundary.lastIndex += 1;
    // Odrzucamy cięcia zbyt blisko krawędzi — mid-CTA ma sens tylko, gdy dzieli treść
    // na dwie realne części (min. 20% długości po każdej stronie).
    if (pos < html.length * 0.2 || pos > html.length * 0.8) continue;
    const dist = Math.abs(pos - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = pos;
    }
  }
  if (best === null) return [html, ""];
  return [html.slice(0, best), html.slice(best)];
}
