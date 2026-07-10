import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { StarRating } from "@/components/StarRating";
import { IconPin, IconUsers } from "@/components/icons";
import { SITE_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Certyfikowane trenerki beauty | ${SITE_NAME}`,
  description:
    "Poznaj certyfikowane trenerki beauty współpracujące z Uniwersytet Beauty. PMU, rzęsy, paznokcie, medycyna estetyczna — wszystkie zarejestrowane w BUR.",
  alternates: { canonical: "/trenerki" },
};

export default async function TrenerkiPage() {
  const db = await getDb();
  const trainers = await db
    .select()
    .from(schema.trainers)
    .where(eq(schema.trainers.isActive, true))
    .orderBy(desc(schema.trainers.reviewCount));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "Strona główna", url: "/" }, { name: "Trenerki", url: "/trenerki" }]} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">Nasze trenerki</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Każda trenerka na platformie jest zweryfikowana, certyfikowana i zarejestrowana w Bazie Usług
        Rozwojowych — dzięki temu jej szkolenia obejmuje dofinansowanie BUR.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {trainers.map((t) => (
          <article key={t.id} className="card overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-sand-200 to-sand-100" aria-hidden />
            <div className="-mt-10 px-6 pb-6">
              <TrainerAvatar name={t.name} avatarUrl={t.avatarUrl} size={80} className="ring-4 ring-white" />
              <h2 className="mt-3 font-serif text-xl font-semibold">
                <Link href={`/trenerka/${t.slug}`} className="hover:text-sand-700 transition-colors">
                  {t.name}
                </Link>
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.specializations.slice(0, 3).map((s) => (
                  <span key={s} className="badge-tag">{s}</span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <StarRating rating={t.rating} reviewCount={t.reviewCount} />
                <span className="inline-flex items-center gap-1">
                  <IconUsers width={15} height={15} /> {t.studentsCount} przeszkolonych
                </span>
                {t.city && (
                  <span className="inline-flex items-center gap-1">
                    <IconPin width={15} height={15} /> {t.city}
                  </span>
                )}
              </div>
              <Link href={`/trenerka/${t.slug}`} className="btn-outline mt-5 w-full !py-2.5 !text-sm">
                Zobacz profil
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
