import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/constants";
import { IconMail } from "@/components/icons";

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
            zdobyć dofinansowanie do 100% z programu BUR.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sand-300 hover:text-cream-warm transition-colors"
          >
            <IconMail width={16} height={16} /> {CONTACT_EMAIL}
          </a>
        </div>

        <nav aria-label="Nawigacja stopki">
          <p className="mb-4 font-serif text-base font-semibold text-cream-warm">Na skróty</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/kursy" className="hover:text-cream-warm transition-colors">Kursy i szkolenia</Link></li>
            <li><Link href="/dofinansowania" className="hover:text-cream-warm transition-colors">Dofinansowania</Link></li>
            <li><Link href="/trenerki" className="hover:text-cream-warm transition-colors">Trenerki</Link></li>
            <li><Link href="/blog" className="hover:text-cream-warm transition-colors">Baza wiedzy</Link></li>
            <li><Link href="/o-nas" className="hover:text-cream-warm transition-colors">O nas</Link></li>
            <li><Link href="/konsultacja" className="hover:text-cream-warm transition-colors">Bezpłatna konsultacja</Link></li>
          </ul>
        </nav>

        <nav aria-label="Informacje prawne">
          <p className="mb-4 font-serif text-base font-semibold text-cream-warm">Informacje prawne</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/regulamin" className="hover:text-cream-warm transition-colors">Regulamin</Link></li>
            <li><Link href="/polityka-prywatnosci" className="hover:text-cream-warm transition-colors">Polityka prywatności</Link></li>
            <li><Link href="/polityka-cookies" className="hover:text-cream-warm transition-colors">Polityka cookies</Link></li>
            <li><Link href="/kontakt" className="hover:text-cream-warm transition-colors">Kontakt</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-sand-200/70">
        © {new Date().getFullYear()} Uniwersytet Beauty. Wszelkie prawa zastrzeżone.
      </div>
    </footer>
  );
}
