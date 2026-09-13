import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StickyConsultationCta } from "@/components/layout/StickyConsultationCta";
import { JsonLd } from "@/components/JsonLd";
import { CookieConsent } from "@/components/CookieConsent";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Encja marki na każdej podstronie — fundament pod Knowledge Panel i rozpoznanie w czatach AI. */}
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      {/* Skip link — bez niego użytkownik klawiatury/czytnika przechodzi przez całe menu
          na każdej podstronie, zanim dotrze do treści (WCAG 2.4.1). */}
      <a href="#tresc" className="skip-link">
        Przejdź do treści
      </a>
      <Navbar />
      <main id="tresc" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      {/* Sticky CTA na mobile — ukrywa się sama na /quiz, patrz komponent */}
      <StickyConsultationCta />
      <CookieConsent />
    </>
  );
}
