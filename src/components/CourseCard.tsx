import Link from "next/link";
import Image from "next/image";
import type { Course, Trainer } from "@/db/schema";
import { IconPin, IconClock } from "./icons";

/**
 * `trainer` zostaje w sygnaturze (wywołania w listingach go przekazują), ale NIE renderujemy
 * już jego tożsamości na karcie — decyzja właściciela 13.09.2026: publicznie chowamy trenerki
 * przed startem płatnej kampanii. Cena i cena po dofinansowaniu też znikają z tego samego
 * powodu: jedyne CTA karty prowadzi do quizu kwalifikacyjnego, nie do transakcji.
 */
export function CourseCard({ course }: { course: Course; trainer?: Trainer | null }) {
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link href={`/kurs/${course.slug}`} className="relative block aspect-[16/10] bg-sand-100">
        {course.imageUrl && (
          <Image
            src={course.imageUrl}
            alt={course.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="badge-money bg-money text-white">Dofinansowanie do {course.subsidyPercent}%</span>
          <span className="badge-tag bg-white/90">{course.category}</span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-serif text-lg font-semibold leading-snug">
          <Link href={`/kurs/${course.slug}`} className="hover:text-sand-700 transition-colors">
            {course.title}
          </Link>
        </h3>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {course.city && (
            <span className="inline-flex items-center gap-1">
              <IconPin width={15} height={15} /> {course.city}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <IconClock width={15} height={15} /> {course.durationHours} godz.
          </span>
        </div>

        <Link href={`/aplikacja?kurs=${course.slug}`} className="btn-primary mt-auto w-full !py-2.5 !text-sm">
          Aplikuj o dofinansowanie
        </Link>
      </div>
    </article>
  );
}
