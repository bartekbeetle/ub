import { getDb, schema } from "@/db";
import { CourseForm } from "@/components/admin/CourseForm";

export const dynamic = "force-dynamic";

export default async function NoweSzkoleniePage() {
  const db = await getDb();
  const trainers = await db.select({ id: schema.trainers.id, name: schema.trainers.name }).from(schema.trainers);
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Dodaj szkolenie</h1>
      <div className="card mt-6 p-6">
        <CourseForm trainers={trainers} />
      </div>
    </div>
  );
}
