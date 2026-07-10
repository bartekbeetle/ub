import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LeadForm } from "@/components/LeadForm";
import { IconCheck } from "@/components/icons";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Bezpłatna konsultacja — sprawdź swoje dofinansowanie | ${SITE_NAME}`,
  description:
    "Umów bezpłatną konsultację: sprawdzimy, jaki poziom dofinansowania na szkolenie beauty przysługuje Ci w Twoim województwie i połączymy Cię z certyfikowaną trenerką.",
  alternates: { canonical: "/konsultacja" },
};

const BENEFITS = [
  "Sprawdzimy Twoje dofinansowanie — bezpłatnie i bez zobowiązań",
  "Dobierzemy szkolenie do Twoich planów i budżetu",
  "Połączymy Cię z certyfikowaną trenerką w Twojej okolicy",
  "Pomożemy w całym procesie wniosku o dofinansowanie",
];

export default function KonsultacjaPage() {
  return (
    <div className="bg-gradient-to-b from-sand-100 via-cream-warm to-cream">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Bezpłatna konsultacja", url: "/konsultacja" }]} />

        <div className="mt-6 grid items-start gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-3xl font-bold leading-tight md:text-5xl">
              Bezpłatna Konsultacja — <span className="text-money">sprawdź swoje dofinansowanie</span>
            </h1>
            <p className="mt-5 text-lg text-muted">
              Zostaw kontakt, a w ciągu 24 godzin sprawdzimy, jaki poziom dofinansowania (nawet 100%)
              przysługuje Ci w Twoim województwie — i pokażemy Ci konkretne szkolenia, na które możesz je
              wykorzystać.
            </p>
            <ul className="mt-8 space-y-4">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <IconCheck width={20} height={20} className="mt-0.5 shrink-0 text-money" />
                  <span className="text-ink">{b}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted">
              Dołącz do <strong className="text-ink-soft">500+ kobiet</strong>, które zaczęły karierę w beauty z
              naszym wsparciem — <strong className="text-money-dark">98% otrzymało pełne dofinansowanie</strong>.
            </p>
          </div>

          <div className="card p-6 md:p-8">
            <h2 className="font-serif text-xl font-bold">Umów bezpłatną konsultację</h2>
            <p className="mb-6 mt-1 text-sm text-muted">Wypełnienie zajmuje mniej niż minutę.</p>
            <LeadForm source="konsultacja" />
          </div>
        </div>
      </div>
    </div>
  );
}
