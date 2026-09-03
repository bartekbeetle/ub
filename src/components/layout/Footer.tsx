import Link from "next/link";
import { CONTACT_EMAIL, OPERATOR_LINE, SITE_NAME } from "@/lib/constants";
import { CookieSettingsLink } from "@/components/CookieConsent";
import { IconMail } from "@/components/icons";

/** Link stopki: `inline-block py-2` daje ~36 px wysokości celu dotykowego zamiast ~20 px
 *  (WCAG 2.5.8 wymaga min. 24 px; na mobile celujemy wyżej). Odstępy wizualnie bez zmian. */
const FOOTER_LINK = "inline-block py-2 transition-colors hover:text-cream-warm";

export function Footer() {
  return (
    <footer className="border-t border-sand-100 bg-ink-soft text-sand-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
        <div className="md:col-span-2">
          <p className="font-serif text-lg font-bold tracking-[3px] text-cream-warm">
            UNIWERSYTET <span className="text-sand-300">BEAUTY</span>
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-sand-200">
            Łączymy kobiety, które chcą zacząć karierę w beauty, z certyfikowanymi trenerkami — i pomagamy
            zdobyć dofinansowanie do 90% z programu BUR.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-4 inline-flex items-center gap-2 py-2 text-sm font-semibold text-sand-300 hover:text-cream-warm transition-colors"
          >
            <IconMail width={16} height={16} /> {CONTACT_EMAIL}
          </a>
        </div>

        <nav aria-label="Nawigacja stopki">
          <p className="mb-4 font-serif text-base font-semibold text-cream-warm">Na skróty</p>
          <ul className="space-y-0.5 text-sm">
            <li><Link href="/kursy" className={FOOTER_LINK}>Kursy i szkolenia</Link></li>
            <li><Link href="/dofinansowania" className={FOOTER_LINK}>Dofinansowania</Link></li>
            <li><Link href="/trenerki" className={FOOTER_LINK}>Trenerki</Link></li>
            <li><Link href="/blog" className={FOOTER_LINK}>Baza wiedzy</Link></li>
            <li><Link href="/o-nas" className={FOOTER_LINK}>O nas</Link></li>
            <li><Link href="/konsultacja" className={FOOTER_LINK}>Bezpłatna konsultacja</Link></li>
          </ul>
        </nav>

        <nav aria-label="Informacje prawne">
          <p className="mb-4 font-serif text-base font-semibold text-cream-warm">Informacje prawne</p>
          <ul className="space-y-0.5 text-sm">
            <li><Link href="/regulamin" className={FOOTER_LINK}>Regulamin</Link></li>
            <li><Link href="/polityka-prywatnosci" className={FOOTER_LINK}>Polityka prywatności</Link></li>
            <li><Link href="/polityka-cookies" className={FOOTER_LINK}>Polityka cookies</Link></li>
            <li><CookieSettingsLink className={FOOTER_LINK} /></li>
            <li><Link href="/kontakt" className={FOOTER_LINK}>Kontakt</Link></li>
          </ul>
        </nav>
      </div>
      {/* Identyfikacja usługodawcy — wymóg art. 5 ustawy o świadczeniu usług drogą elektroniczną
          i art. 13 RODO (tożsamość administratora danych musi być łatwo dostępna). */}
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs leading-relaxed text-sand-200/70">
        <p>{OPERATOR_LINE}</p>
        <p className="mt-1">
          © {new Date().getFullYear()} {SITE_NAME}. Wszelkie prawa zastrzeżone.
        </p>
      </div>
    </footer>
  );
}
