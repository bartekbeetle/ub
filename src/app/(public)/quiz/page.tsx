import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Quiz } from "@/components/Quiz";
import { CATEGORIES, SITE_NAME } from "@/lib/constants";
import { IconCheck } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Aplikuj o dofinansowanie`,
  description:
    "Odpowiedz na kilka pytań, a sprawdzimy Twoje dofinansowanie na szkolenie beauty i połączymy Cię z certyfikowaną trenerką.",
  alternates: { canonical: "/quiz" },
  robots: { index: false, follow: true }, // strona formularza — nic tu nie ma do zaindeksowania
  openGraph: {
    title: `Aplikuj o dofinansowanie — ${SITE_NAME}`,
    description:
      "Odpowiedz na kilka pytań, a sprawdzimy Twoje dofinansowanie na szkolenie beauty i połączymy Cię z certyfikowaną trenerką.",
    url: "/quiz",
    type: "website",
    locale: "pl_PL",
    siteName: SITE_NAME,
  },
};

const BENEFITS = [
  "Zajmuje mniej niż 2 minuty",
  "Sprawdzimy Twoje dofinansowanie bezpłatnie i bez zobowiązań",
  "Połączymy Cię z certyfikowaną trenerką w Twojej okolicy",
];

type Search = { [key: string]: string | string[] | undefined };

async function resolveCourse(slug: string | undefined) {
  if (!slug) return null;
  const db = await getDb();
  const rows = await db
    .select({ id: schema.courses.id, category: schema.courses.category, voivodeship: schema.courses.voivodeship })
    .from(schema.courses)
    .where(eq(schema.courses.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export default async function QuizPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const kurs = typeof sp.kurs === "string" ? sp.kurs : undefined;
  const kategoriaParam = typeof sp.kategoria === "string" ? sp.kategoria : undefined;

  const course = await resolveCourse(kurs);
  const defaultCategory =
    course?.category ?? (kategoriaParam && (CATEGORIES as readonly string[]).includes(kategoriaParam) ? kategoriaParam : undefined);
  const defaultVoivodeship = course?.voivodeship ?? undefined;

  return (
    <div className="bg-gradient-to-b from-sand-100 via-cream-warm to-cream">
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-6 md:py-14">
        <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Aplikuj o dofinansowanie", url: "/quiz" }]} />

        <h1 className="mt-4 text-center text-3xl font-bold md:text-4xl">Sprawdź swoje dofinansowanie</h1>
        <ul className="mx-auto mt-5 flex max-w-md flex-col gap-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-ink">
              <IconCheck width={18} height={18} className="mt-0.5 shrink-0 text-money" />
              {b}
            </li>
          ))}
        </ul>

        <div className="card mt-8 p-6 md:p-8">
          <Quiz courseId={course?.id ?? null} defaultCategory={defaultCategory} defaultVoivodeship={defaultVoivodeship} />
        </div>
      </div>
    </div>
  );
}
