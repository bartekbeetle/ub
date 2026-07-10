import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContactForm } from "@/components/ContactForm";
import { IconMail, IconClock } from "@/components/icons";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Kontakt | ${SITE_NAME}`,
  description: "Skontaktuj się z Uniwersytet Beauty — pytania o szkolenia, dofinansowania BUR i współpracę trenerską.",
  alternates: { canonical: "/kontakt" },
};

export default function KontaktPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Kontakt", url: "/kontakt" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Kontakt</h1>
      <p className="mt-2 max-w-xl text-muted">
        Masz pytanie o szkolenie, dofinansowanie albo współpracę trenerską? Napisz — odpowiadamy w 24h.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_320px]">
        <div className="card p-6 md:p-8">
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
