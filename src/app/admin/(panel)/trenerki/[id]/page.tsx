import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { TrainerForm } from "@/components/admin/TrainerForm";

export const dynamic = "force-dynamic";

export default async function EdycjaTrenerkiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trainerId = Number(id);
  if (!Number.isInteger(trainerId)) notFound();
  const db = await getDb();
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, trainerId)).limit(1);
  if (!trainer) notFound();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Edytuj: {trainer.name}</h1>
      <div className="card mt-6 p-6">
        <TrainerForm trainer={trainer} />
      </div>
    </div>
  );
}
