import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // GA4 + Meta Pixel wymagają zewnętrznych skryptów; inline dla JSON-LD i init pixela.
      // 'unsafe-eval' TYLKO w dev — Next.js React Refresh (HMR) go wymaga; na prod CSP zostaje ostry.
      // 29.09.2026: domeny Google Ads dopisane wg oficjalnej listy Google
      // (developers.google.com/tag-platform/security/guides/csp, sekcje „Google Analytics",
      // „Google Ads", „Google Ads User Data"). Bez nich przeglądarka po cichu blokowała każdą
      // konwersję Google Ads (googleadservices / google.com/ccm / doubleclick) — akcja
      // „UB - Lead" w Ads miała stan „Nieaktywny" mimo poprawnej etykiety w kodzie.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com https://connect.facebook.net`,
      "style-src 'self' 'unsafe-inline'",
      // GA4 i Google Ads wysyłają pingi też przez piksel-obrazek.
      "img-src 'self' data: blob: https://www.facebook.com https://*.google-analytics.com https://www.googletagmanager.com https://www.googleadservices.com https://*.g.doubleclick.net https://pagead2.googlesyndication.com https://*.google.com https://*.google.pl",
      "font-src 'self' data:",
      // GA4 zbiera na region1/region.../analytics.google.com zależnie od regionu konta —
      // wąska lista dwóch hostów po cichu blokowała część wysyłek. Wildcard zamiast zgadywania.
      "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.googleadservices.com https://*.g.doubleclick.net https://ad.doubleclick.net https://pagead2.googlesyndication.com https://*.google.com https://*.google.pl https://www.facebook.com https://connect.facebook.net",
      // Tag Google osadza ramkę z googletagmanager.com (m.in. beacon danych użytkownika Ads).
      // Bez frame-src spada na default-src 'self' i ramka jest blokowana.
      "frame-src https://www.googletagmanager.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "nodemailer", "bcryptjs"],
  // Nie zdradzaj frameworka/wersji w nagłówku `x-powered-by` — ułatwia dobór exploita pod Next.
  poweredByHeader: false,
  // Standalone: produkuje samowystarczalny `.next/standalone/server.js` (plain node),
  // dużo stabilniejszy w kontenerze niż `next start` (który tu cicho nie serwował).
  output: "standalone",
  images: {
    // AVIF przed WebP: te same zdjęcia ważą ok. 20–30% mniej, a wszystkie przeglądarki
    // z rynku PL (Chrome/Safari/Firefox/Edge od 2023) go obsługują. Przy stronie, gdzie
    // zdjęcia kursów i nagłówki bloga to największa pozycja transferu, to realny zysk na LCP.
    formats: ["image/avif", "image/webp"],
    // Rok cache'u na przetworzone warianty — pliki źródłowe są statyczne i wersjonowane w repo.
    minimumCacheTTL: 31536000,
  },
  // Bez tego Next.js zgaduje root workspace po zabłąkanym lockfile w katalogu domowym
  // i zagnieżdża standalone w podkatalogu (server.js ląduje w złym miejscu).
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Zakładka w menu nazywa się „Szkolenia" — ludzie wpisują /szkolenia z ręki.
      { source: "/szkolenia", destination: "/kursy", permanent: true },
      { source: "/szkolenia/:slug", destination: "/kurs/:slug", permanent: true },
      // `/quiz` → `/aplikacja` (18.09.2026): formularz przestał być „quizem" i stał się
      // aplikacją o dofinansowanie — zmiana dotyczy też adresu, bo kursantka go widzi.
      // 308 zachowuje parametry (`?kurs=`, `?kategoria=`, UTM-y z reklam), więc stare linki
      // z bloga, wizytówki i llms.txt dalej działają.
      { source: "/quiz", destination: "/aplikacja", permanent: true },
    ];
  },
};

export default nextConfig;
