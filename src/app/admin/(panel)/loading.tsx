import { Skeleton } from "@/components/ui/Skeleton";

/** Zmiana zakładki: zamiast pustego ekranu szkielet w kształcie typowego widoku (nagłówek, kafle, tabela). */
export default function AdminLoading() {
  return (
    <div role="status" aria-label="Ładowanie widoku">
      <Skeleton className="h-8 w-56" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card p-5">
            <Skeleton className="h-5 w-32 rounded-lg" />
            <Skeleton className="mt-4 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="card mt-6 p-5">
        <Skeleton className="h-5 w-48" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="grid grid-cols-[110px_1fr_1fr_90px] gap-4">
              <Skeleton className="h-3.5" />
              <Skeleton className="h-3.5" />
              <Skeleton className={`h-3.5 ${i % 2 ? "w-2/3" : ""}`} />
              <Skeleton className="h-3.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
