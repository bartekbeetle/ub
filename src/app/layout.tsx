import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
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
  alternates: { canonical: "/", languages: { pl: "/" } },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: SITE_NAME,
  },
  twitter: { card: "summary_large_image" },
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
