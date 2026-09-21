import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AcademyRegistrationForm } from "@/components/AcademyRegistrationForm";
import { SITE_NAME } from "@/lib/constants";

const TITLE = "Załóż konto akademii — Uniwersytet Beauty";
const DESCRIPTION =
  "Załóż konto akademii w Uniwersytecie Beauty i odbieraj zgłoszenia kursantek szukających szkoleń beauty z dofinansowaniem z BUR.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/dla-akademii/rejestracja" },
  // Formularz rejestracji nie ma czego szukać w indeksie — ruch ma iść przez stronę ofertową,
  // która wyjaśnia zasady. Ten sam wzorzec co `/aplikacja` po stronie kursantek.
  robots: { index: false, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/dla-akademii/rejestracja", type: "website", locale: "pl_PL", siteName: SITE_NAME },
};

export default function RejestracjaAkademiiPage() {
  return (
    <div className="bg-gradient-to-b from-sand-100 via-cream-warm to-cream">
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <Breadcrumbs
          items={[
            { name: "Strona główna", url: "/" },
            { name: "Dla akademii", url: "/dla-akademii" },
            { name: "Załóż konto", url: "/dla-akademii/rejestracja" },
          ]}
        />

        <header className="mt-6">
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">Załóż konto akademii</h1>
          <p className="mt-4 text-muted">
            Konto działa od razu — zobaczysz w nim swój profil i postęp weryfikacji. Zgłoszenia kursantek trafiają do
            panelu po rozmowie i podpisaniu umowy partnerskiej.
          </p>
        </header>

        <div className="card mt-8 p-6 md:p-8">
          <AcademyRegistrationForm />
        </div>
      </div>
    </div>
  );
}
