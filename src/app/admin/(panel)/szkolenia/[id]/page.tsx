import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CourseForm } from "@/components/admin/CourseForm";

export const dynamic = "force-dynamic";

export default async function EdycjaSzkoleniaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();
  const db = await getDb();
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, courseId)).limit(1);
  if (!course) notFound();
  const trainers = await db.select({ id: schema.trainers.id, name: schema.trainers.name }).from(schema.trainers);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Edytuj: {course.title}</h1>
      <div className="card mt-6 p-6">
        <CourseForm course={course} trainers={trainers} />
      </div>
    </div>
  );
}
