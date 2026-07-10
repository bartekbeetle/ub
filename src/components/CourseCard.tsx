import Link from "next/link";
import Image from "next/image";
import type { Course, Trainer } from "@/db/schema";
import { TrainerAvatar } from "./TrainerAvatar";
import { StarRating } from "./StarRating";
import { IconPin, IconClock } from "./icons";
import { formatPln } from "@/lib/utils";

export function CourseCard({ course, trainer }: { course: Course; trainer?: Trainer | null }) {
  const priceAfter = Math.round(course.price * (1 - course.subsidyPercent / 100));
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

        {trainer && (
          <div className="flex items-center gap-2">
            <TrainerAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} size={28} />
            <span className="text-sm font-medium text-ink">{trainer.name}</span>
            <StarRating rating={trainer.rating} reviewCount={trainer.reviewCount} />
          </div>
        )}

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

        <div className="mt-auto flex items-end justify-between border-t border-sand-100 pt-4">
          <div>
            <p className="text-sm text-muted line-through">{formatPln(course.price)}</p>
            <p className="text-xl font-bold text-money-dark">
              {priceAfter === 0 ? "Od 0 zł" : `Od ${formatPln(priceAfter)}`}
            </p>
          </div>
          <Link href={`/kurs/${course.slug}`} className="btn-primary !px-5 !py-2.5 !text-sm">
            Zobacz szczegóły
          </Link>
        </div>
      </div>
    </article>
  );
}
