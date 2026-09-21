import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { TrainerForm } from "@/components/admin/TrainerForm";
import { TrainerAccountButton } from "@/components/admin/TrainerAccountButton";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EdycjaTrenerkiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trainerId = Number(id);
  if (!Number.isInteger(trainerId)) notFound();
  const db = await getDb();
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, trainerId)).limit(1);
  if (!trainer) notFound();

  // Konto do panelu jest osobnym bytem od profilu: profil może istnieć bez konta (tak powstają
  // trenerki dodane ręcznie), a od września 2026 konto może powstać samo z rejestracji.
  const [account] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      mustChangePassword: schema.users.mustChangePassword,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.trainerId, trainerId))
    .limit(1);

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Edytuj: {trainer.name}</h1>

      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Dostęp do panelu</h2>
        {account ? (
          <dl className="mt-3 grid grid-cols-[200px_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted">Login</dt>
            <dd className="font-medium">{account.email}</dd>
            <dt className="text-muted">Konto założone</dt>
            <dd>{formatDateTime(account.createdAt)}</dd>
            <dt className="text-muted">Hasło</dt>
            <dd>{account.mustChangePassword ? "startowe — czeka na zmianę przez trenerkę" : "ustawione własne"}</dd>
            <dt className="text-muted">Widzi dane kursantek</dt>
            <dd>
              {trainer.isActive ? (
                "tak — profil aktywny"
              ) : (
                <span className="text-amber-700">nie — profil nieaktywny (onboarding)</span>
              )}
            </dd>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Ta trenerka nie ma konta do panelu — nie zaloguje się i nie zobaczy przydzielonych kursantek.
          </p>
        )}
        <div className="mt-4">
          <TrainerAccountButton
            trainerId={trainer.id}
            hasAccount={Boolean(account)}
            accountEmail={account?.email ?? null}
            trainerEmail={trainer.email}
          />
        </div>
      </div>

      <div className="card mt-6 p-6">
        <TrainerForm trainer={trainer} />
      </div>
    </div>
  );
}
