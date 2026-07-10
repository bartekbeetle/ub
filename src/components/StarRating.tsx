import { IconStar } from "./icons";

/** rating = ocena × 10 (49 -> 4.9) */
export function StarRating({
  rating,
  reviewCount,
  className = "",
}: {
  rating: number;
  reviewCount?: number;
  className?: string;
}) {
  if (!rating) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${className}`}>
      <IconStar width={16} height={16} className="text-gold" />
      <span className="font-semibold text-ink-soft">{(rating / 10).toFixed(1).replace(".", ",")}</span>
      {reviewCount !== undefined && <span className="text-muted">({reviewCount} opinii)</span>}
    </span>
  );
}
