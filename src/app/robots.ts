import type { MetadataRoute } from "next";
import { CANONICAL_DOMAIN, IS_PRODUCTION_HOST, SITE_URL } from "@/lib/constants";

/** Ścieżki, które nigdy nie mają trafić do indeksu (panele, API, potwierdzenia, wyniki wyszukiwarki). */
const PRIVATE_PATHS = ["/admin", "/panel", "/api", "/wyloguj", "/dziekujemy", "/kursy?q="];

/**
 * Crawlery modeli AI (ChatGPT, Claude, Perplexity, Gemini, Copilot).
 * ŚWIADOMA DECYZJA: wpuszczamy je. Chcemy być cytowani w odpowiedziach AI —
 * to darmowy kanał leadów w niszy, gdzie ludzie pytają „czy dostanę dofinansowanie na kurs PMU".
 * Blokada = zniknięcie z odpowiedzi AI, a nie ochrona treści (treść i tak jest publiczna).
 */
const AI_CRAWLERS = [
  "GPTBot", // trenowanie OpenAI
  "OAI-SearchBot", // indeks wyszukiwarki ChatGPT
  "ChatGPT-User", // pobranie na żądanie użytkownika w czacie
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended", // Gemini / AI Overviews grounding
  "Applebot-Extended",
  "Bingbot", // zasila też Copilota
  "CCBot", // Common Crawl — źródło treningowe wielu modeli
];

export default function robots(): MetadataRoute.Robots {
  // Host tymczasowy (sslip.io / localhost): pełna blokada. Bez tego Google zaindeksuje
  // adres, który za chwilę zniknie, a docelowa domena startuje z duplikatem treści.
  if (!IS_PRODUCTION_HOST) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE_PATHS })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: CANONICAL_DOMAIN,
  };
}
