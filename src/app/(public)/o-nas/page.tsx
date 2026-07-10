import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `O nas | ${SITE_NAME}`,
  description:
    "Uniwersytet Beauty łączy kobiety planujące karierę w branży beauty z certyfikowanymi trenerkami i pomaga zdobyć dofinansowanie do 100% z programu BUR.",
  alternates: { canonical: "/o-nas" },
};

export default function ONasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "O nas", url: "/o-nas" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">O Uniwersytecie Beauty</h1>

      <div className="relative mt-8 aspect-[16/8] overflow-hidden rounded-[12px] bg-sand-100">
        <Image src="/images/akademia-sala.jpg" alt="Sala szkoleniowa akademii beauty" fill priority sizes="(max-width: 768px) 100vw, 896px" className="object-cover" />
      </div>

      <div className="prose-ub mt-8">
        <p>
          <strong>Uniwersytet Beauty</strong> powstał z jednej obserwacji: tysiące kobiet w Polsce marzy o karierze
          w branży beauty, ale odkłada ją na później, bo dobre szkolenie kosztuje kilka tysięcy złotych.
          Tymczasem istnieją programy, które pokrywają <strong>do 100% ceny kursu</strong> — tylko mało kto o nich
          wie, a jeszcze mniej osób umie przejść przez proces wniosku.
        </p>
        <p>
          Łączymy dwie strony: <strong>kobiety, które chcą zdobyć zawód beauty</strong>, oraz{" "}
          <strong>certyfikowane trenerki</strong> zarejestrowane w Bazie Usług Rozwojowych. Kandydatkom pomagamy
          bezpłatnie sprawdzić i uzyskać dofinansowanie, trenerkom — dostarczamy kursantki gotowe do startu.
        </p>
        <h2>Co nas wyróżnia</h2>
        <ul>
          <li><strong>Znamy BUR od podszewki</strong> — wiemy, że dofinansowania nie są tylko dla bezrobotnych, i pomagamy z wnioskami w każdym województwie.</li>
          <li><strong>Weryfikujemy trenerki</strong> — na platformie znajdziesz wyłącznie doświadczone szkoleniowczynie z certyfikatami i realnymi opiniami kursantek.</li>
          <li><strong>Prowadzimy Cię za rękę</strong> — od wyboru kursu, przez wniosek, po rozliczenie dofinansowania.</li>
        </ul>
        <h2>Nasze wyniki</h2>
        <p>
          Do dziś pomogłyśmy ponad <strong>500 kobietom</strong> rozpocząć karierę w beauty, a{" "}
          <strong>98% naszych kursantek</strong> otrzymało pełne dofinansowanie na wybrane szkolenie.
        </p>
      </div>

      <div className="card mt-10 bg-cream-warm p-8 text-center">
        <h2 className="font-serif text-2xl font-bold">Chcesz dołączyć do nich?</h2>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/konsultacja" className="btn-primary">Umów bezpłatną konsultację</Link>
          <Link href="/kursy" className="btn-outline">Zobacz szkolenia</Link>
        </div>
      </div>
    </div>
  );
}
