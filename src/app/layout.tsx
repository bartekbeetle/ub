import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { IS_PRODUCTION_HOST, ORG_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "600", "700"],
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Szkolenia beauty z dofinansowaniem do 90%`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Profesjonalne szkolenia beauty z dofinansowaniem do 90% z programu BUR. PMU, stylizacja rzęs i paznokci, medycyna estetyczna. Certyfikowane trenerki, wsparcie w całym procesie.",
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  publisher: SITE_NAME,
  category: "education",
  alternates: { canonical: "/", languages: { "pl-PL": "/" } },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: SITE_NAME,
    // Domyślny OG dla każdej podstrony, która nie ustawia własnego obrazka.
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: `${SITE_NAME} — ${ORG_DESCRIPTION.slice(0, 60)}` }],
  },
  twitter: { card: "summary_large_image", images: ["/og-default.png"] },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  // Na hoście tymczasowym (sslip.io/localhost) każda strona dostaje noindex —
  // druga warstwa ochrony obok robots.txt.
  robots: IS_PRODUCTION_HOST
    ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
    : { index: false, follow: false, nocache: true },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
