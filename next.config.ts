import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // GA4 + Meta Pixel wymagają zewnętrznych skryptów; inline dla JSON-LD i init pixela.
      // 'unsafe-eval' TYLKO w dev — Next.js React Refresh (HMR) go wymaga; na prod CSP zostaje ostry.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://connect.facebook.net`,
      "style-src 'self' 'unsafe-inline'",
      // GA4 wysyła pingi też przez piksel-obrazek i przez googletagmanager.com.
      "img-src 'self' data: blob: https://www.facebook.com https://*.google-analytics.com https://www.googletagmanager.com",
      "font-src 'self' data:",
      // GA4 zbiera na region1/region.../analytics.google.com zależnie od regionu konta —
      // wąska lista dwóch hostów po cichu blokowała część wysyłek. Wildcard zamiast zgadywania.
      "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com",
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
  // Standalone: produkuje samowystarczalny `.next/standalone/server.js` (plain node),
  // dużo stabilniejszy w kontenerze niż `next start` (który tu cicho nie serwował).
  output: "standalone",
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
    ];
  },
};

export default nextConfig;
