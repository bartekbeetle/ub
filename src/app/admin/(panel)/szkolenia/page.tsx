import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { formatPln, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SzkoleniaAdminPage() {
  const db = await getDb();
  const rows = await db
    .select({ course: schema.courses, trainer: schema.trainers })
    .from(schema.courses)
    .leftJoin(schema.trainers, eq(schema.courses.trainerId, schema.trainers.id))
    .orderBy(desc(schema.courses.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Szkolenia <span className="text-base font-normal text-muted">({rows.length})</span></h1>
        <Link href="/admin/szkolenia/nowe" className="btn-primary !px-4 !py-2 !text-sm">+ Dodaj szkolenie</Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Tytuł</th>
              <th className="px-4 py-3 font-semibold">Kategoria</th>
              <th className="px-4 py-3 font-semibold">Trenerka</th>
              <th className="px-4 py-3 font-semibold">Cena</th>
              <th className="px-4 py-3 font-semibold">Termin</th>
              <th className="px-4 py-3 font-semibold">Miejsca</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ course, trainer }) => (
              <tr key={course.id} className="hover:bg-gray-50">
                <td className="max-w-xs px-4 py-3 font-semibold">{course.title}</td>
                <td className="px-4 py-3 text-xs">{course.category}</td>
                <td className="px-4 py-3">{trainer?.name ?? "—"}</td>
                <td className="px-4 py-3">{formatPln(course.price)} <span className="text-xs text-money-dark">(-{course.subsidyPercent}%)</span></td>
                <td className="px-4 py-3 text-xs">{formatDate(course.nextDate)}</td>
                <td className="px-4 py-3">{course.takenSpots}/{course.totalSpots}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${course.status === "opublikowane" ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
                    {course.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs font-semibold">
                    <Link href={`/admin/szkolenia/${course.id}`} className="text-sand-700 hover:underline">Edytuj</Link>
                    <a href={`/kurs/${course.slug}`} target="_blank" className="text-muted hover:underline">Podgląd →</a>
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
