import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CourseCard } from "@/components/CourseCard";
import { IconGraduation, IconShield, IconUsers, IconAward, IconArrowRight, IconCheck } from "@/components/icons";
import { SITE_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Szkolenia beauty z dofinansowaniem do 100%`,
  description:
    "Zacznij karierę w beauty bez ryzyka finansowego. Szkolenia z PMU, rzęs, paznokci i medycyny estetycznej z dofinansowaniem do 100% z programu BUR. Nie potrzebujesz doświadczenia.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `Szkolenia beauty z dofinansowaniem do 100%`,
    description: "Profesjonalne szkolenia beauty z dofinansowaniem BUR. Nie potrzebujesz doświadczenia.",
    url: "/",
    images: [{ url: "/images/akademia-sala.jpg", width: 1600, height: 872, alt: "Sala szkoleniowa akademii beauty" }],
  },
};

const STEPS = [
  { title: "Wybierz Szkolenie", text: "Przejrzyj katalog certyfikowanych kursów i wybierz ten, który pasuje do Twoich planów." },
  { title: "Skontaktuj Się z Nami", text: "Wypełnij krótki formularz — sprawdzimy Twoje dofinansowanie i pomożemy w całym procesie." },
  { title: "Złóż Wniosek", text: "Wspieramy Cię w przygotowaniu wniosku do operatora BUR w Twoim województwie." },
  { title: "Rozpocznij Naukę", text: "Po przyznaniu środków zaczynasz szkolenie u certyfikowanej trenerki — nawet za 0 zł." },
];

const WHY = [
  { icon: IconGraduation, title: "Doświadczenie w branży", text: "Współpracujemy wyłącznie z trenerkami z wieloletnią praktyką i setkami przeszkolonych kursantek." },
  { icon: IconShield, title: "Ekspertki od BUR", text: "Znamy proces dofinansowań od podszewki — prowadzimy Cię od wniosku po rozliczenie." },
  { icon: IconUsers, title: "Wsparcie w całym procesie", text: "Nie zostawiamy Cię z papierologią. Formalności ogarniamy razem, Ty skupiasz się na nauce." },
  { icon: IconAward, title: "Certyfikowane trenerki", text: "Każda trenerka na platformie jest zweryfikowana i zarejestrowana w Bazie Usług Rozwojowych." },
];

export default async function HomePage() {
  const db = await getDb();
  const featured = await db
    .select({ course: schema.courses, trainer: schema.trainers })
    .from(schema.courses)
    .leftJoin(schema.trainers, eq(schema.courses.trainerId, schema.trainers.id))
    .where(eq(schema.courses.status, "opublikowane"))
    .orderBy(desc(schema.courses.createdAt))
    .limit(3);

  return (
    <>
      {/* HERO */}
      <section className="bg-gradient-to-b from-sand-100 via-cream-warm to-cream">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
          <span className="badge-money mb-6 inline-flex !px-4 !py-1.5 !text-sm">
            <IconGraduation width={16} height={16} /> Szkolenia z dofinansowaniem do 100%
          </span>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            Zacznij Karierę w Beauty <span className="text-sand-500">BEZ Ryzyka Finansowego</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted md:text-xl">
            Profesjonalne szkolenia z linergistyki, PMU i medycyny estetycznej z dofinansowaniem do 100% z
            programu BUR. <strong className="text-ink-soft">Nie potrzebujesz doświadczenia.</strong>
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/kursy" className="btn-primary !px-10 !py-4 !text-lg">
              Zobacz Jak Zacząć
            </Link>
            <Link href="/dofinansowania" className="btn-outline !px-8 !py-3.5">
              Sprawdź dofinansowanie
            </Link>
          </div>
        </div>
      </section>

      {/* SZKOLENIA */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20" aria-labelledby="szkolenia-h">
        <div className="mb-10 text-center">
          <h2 id="szkolenia-h" className="text-3xl font-bold md:text-4xl">Szkolenia z Dofinansowaniem BUR</h2>
          <p className="mt-3 text-muted">Certyfikowane kursy, po których zaczniesz zarabiać w branży beauty.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map(({ course, trainer }) => (
            <CourseCard key={course.id} course={course} trainer={trainer} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/kursy" className="inline-flex items-center gap-2 font-semibold text-sand-700 hover:text-sand-500 transition-colors">
            Zobacz wszystkie szkolenia <IconArrowRight width={18} height={18} />
          </Link>
        </div>
      </section>

      {/* 4 KROKI */}
      <section className="bg-cream-warm py-16 md:py-20" aria-labelledby="kroki-h">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <h2 id="kroki-h" className="text-center text-3xl font-bold md:text-4xl">
            Jak Zdobyć Dofinansowanie w 4 Krokach
          </h2>
          <ol className="mt-12 space-y-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="card flex items-start gap-5 p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-sand-400 font-serif text-xl font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-serif text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Link href="/konsultacja" className="btn-primary">Umów bezpłatną konsultację</Link>
          </div>
        </div>
      </section>

      {/* DLACZEGO MY */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20" aria-labelledby="dlaczego-h">
        <h2 id="dlaczego-h" className="text-center text-3xl font-bold md:text-4xl">Dlaczego Uniwersytet Beauty</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {WHY.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sand-700">
                <Icon width={22} height={22} />
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ZAUFANIE */}
      <section className="bg-ink-soft py-14 text-center" aria-label="Nasze wyniki">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-10 px-4 sm:flex-row">
          <div>
            <p className="font-serif text-4xl font-bold text-sand-300">500+</p>
            <p className="mt-2 text-sand-100">przeszkolonych specjalistek beauty</p>
          </div>
          <div className="hidden h-14 w-px bg-white/20 sm:block" aria-hidden />
          <div>
            <p className="font-serif text-4xl font-bold text-money">98%</p>
            <p className="mt-2 text-sand-100">kursantek otrzymało pełne dofinansowanie</p>
          </div>
        </div>
        <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 text-sm text-sand-200">
          {["Certyfikowane kursy", "Bezpieczne dofinansowanie", "Wsparcie na każdym etapie"].map((t) => (
            <li key={t} className="inline-flex items-center gap-2">
              <IconCheck width={16} height={16} className="text-money" /> {t}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
