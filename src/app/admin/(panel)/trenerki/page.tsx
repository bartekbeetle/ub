import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { formatPln } from "@/lib/utils";
import { voivodeshipName } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function TrenerkiAdminPage() {
  const db = await getDb();
  const trainers = await db.select().from(schema.trainers).orderBy(desc(schema.trainers.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Trenerki <span className="text-base font-normal text-muted">({trainers.length})</span></h1>
        <Link href="/admin/trenerki/nowa" className="btn-primary !px-4 !py-2 !text-sm">+ Dodaj trenerkę</Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Trenerka</th>
              <th className="px-4 py-3 font-semibold">Specjalizacje</th>
              <th className="px-4 py-3 font-semibold">Lokalizacja</th>
              <th className="px-4 py-3 font-semibold">Rozliczenie</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {trainers.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <TrainerAvatar name={t.name} avatarUrl={t.avatarUrl} size={36} />
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-xs text-muted">{t.email ?? "brak emaila"}</p>
                    </div>
                  </div>
                </td>
                <td className="max-w-xs px-4 py-3 text-xs">{t.specializations.join(", ")}</td>
                <td className="px-4 py-3">{t.city ?? "—"}{t.voivodeship ? `, ${voivodeshipName(t.voivodeship)}` : ""}</td>
                <td className="px-4 py-3 text-xs">
                  {t.billingModel === "per_lead" ? "za lead" : "za zapis"} · {formatPln(t.rate)}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${t.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
                    {t.isActive ? "Aktywna" : "Nieaktywna"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs font-semibold">
                    <Link href={`/admin/trenerki/${t.id}`} className="text-sand-700 hover:underline">Edytuj</Link>
                    <a href={`/trenerka/${t.slug}`} target="_blank" className="text-muted hover:underline">Profil →</a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
