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
      "img-src 'self' data: blob: https://www.facebook.com https://www.google-analytics.com",
      "font-src 'self' data:",
      "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.facebook.com",
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
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
