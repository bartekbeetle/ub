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
