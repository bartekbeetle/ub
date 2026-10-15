/** Szkielet ładowania — kształt docelowej treści zamiast spinnera na środku. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** Szkielet karty szczegółów: tytuł + kilka wierszy „etykieta — wartość". */
export function SkeletonCard({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card p-5">
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid grid-cols-[120px_1fr] gap-3">
            <Skeleton className="h-3.5" />
            <Skeleton className={`h-3.5 ${i % 3 === 1 ? "w-1/2" : i % 3 === 2 ? "w-2/3" : ""}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Szkielet panelu szczegółów kursantki. */
export function SkeletonLeadDetail() {
  return (
    <div role="status" aria-label="Ładowanie danych kursantki" className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-24 rounded-full" />
      </div>
      <SkeletonCard rows={8} />
      <SkeletonCard rows={3} />
    </div>
  );
}
