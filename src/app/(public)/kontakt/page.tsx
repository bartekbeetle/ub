import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContactForm } from "@/components/ContactForm";
import { IconMail, IconClock, IconArrowRight } from "@/components/icons";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Kontakt`,
  description: "Masz pytanie o szkolenie beauty, dofinansowanie z BUR albo współpracę trenerską? Napisz do Uniwersytetu Beauty — odpowiadamy w 24 godziny robocze.",
  alternates: { canonical: "/kontakt" },
  openGraph: {
    title: `Kontakt — ${SITE_NAME}`,
    description: "Masz pytanie o szkolenie beauty, dofinansowanie z BUR albo współpracę trenerską? Napisz do Uniwersytetu Beauty — odpowiadamy w 24 godziny robocze.",
    url: "/kontakt",
    type: "website",
    locale: "pl_PL",
    siteName: SITE_NAME,
  },
};

export default function KontaktPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Kontakt", url: "/kontakt" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Kontakt</h1>
      <p className="mt-2 max-w-xl text-muted">
        Masz pytanie o szkolenie, dofinansowanie albo współpracę trenerską? Napisz — odpowiadamy w 24h.
      </p>

      {/* Pytasz o dofinansowanie? Szybsza ścieżka niż formularz kontaktowy — prosto w quiz,
          bez czekania na odpowiedź mailem. Formularz kontaktowy zostaje niżej dla reszty pytań. */}
      <div className="card mt-8 flex flex-col items-start gap-4 bg-cream-warm p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
        <div>
          <h2 className="font-serif text-xl font-bold">Pytasz o dofinansowanie na szkolenie?</h2>
          <p className="mt-1 text-sm text-muted">
            Szybciej niż mailem — odpowiedz na kilka pytań, a sprawdzimy Twoje dofinansowanie od razu.
          </p>
        </div>
        <Link href="/aplikacja" className="btn-primary shrink-0 whitespace-nowrap">
          Aplikuj o dofinansowanie <IconArrowRight width={18} height={18} />
        </Link>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_320px]">
        <div className="card p-6 md:p-8">
          <h2 className="font-serif text-lg font-semibold">Inne pytanie?</h2>
          <p className="mb-6 mt-1 text-sm text-muted">Napisz do nas — odpowiadamy w 24 godziny robocze.</p>
          <ContactForm type="kontakt" />
        </div>
        <aside className="space-y-5">
          <div className="card flex items-start gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sand-700">
              <IconMail width={20} height={20} />
            </span>
            <div>
              <p className="font-semibold text-ink-soft">Email</p>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-sand-700 underline">{CONTACT_EMAIL}</a>
            </div>
          </div>
          <div className="card flex items-start gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sand-700">
              <IconClock width={20} height={20} />
            </span>
            <div>
              <p className="font-semibold text-ink-soft">Czas odpowiedzi</p>
              <p className="text-sm text-muted">Do 24 godzin w dni robocze</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
