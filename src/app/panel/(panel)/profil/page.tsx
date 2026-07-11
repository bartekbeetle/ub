import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { ProfileForm } from "@/components/panel/ProfileForm";
import { formatPln } from "@/lib/utils";
import { voivodeshipName } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PanelProfilPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "trenerka" || !user.trainerId) redirect("/panel/login");

  const db = await getDb();
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, user.trainerId)).limit(1);
  if (!trainer) redirect("/panel/login");

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-2xl font-bold">Mój profil</h1>

      {/* DANE USTALANE PRZEZ ADMINA — read-only */}
      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Dane konta</h2>
        <p className="mb-4 text-xs text-muted">Te pola ustala administrator. W razie zmian skontaktuj się z biurem.</p>
        <dl className="grid grid-cols-[160px_1fr] gap-y-2.5 text-sm">
          <dt className="text-muted">Nazwa</dt>
          <dd className="font-medium">{trainer.name}</dd>
          <dt className="text-muted">Email logowania</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted">Specjalizacje</dt>
          <dd>{trainer.specializations.length ? trainer.specializations.join(", ") : "—"}</dd>
          <dt className="text-muted">Miasto</dt>
          <dd>{trainer.city ?? "—"}</dd>
          <dt className="text-muted">Województwo</dt>
          <dd>{voivodeshipName(trainer.voivodeship) || "—"}</dd>
          <dt className="text-muted">Model rozliczenia</dt>
          <dd>{trainer.billingModel === "per_lead" ? "opłata za lead" : "opłata za zapisaną kursantkę"}</dd>
          <dt className="text-muted">Stawka</dt>
          <dd>{formatPln(trainer.rate)}</dd>
          <dt className="text-muted">Limit leadów / mies.</dt>
          <dd>{trainer.leadLimitMonthly}</dd>
        </dl>
      </div>

      {/* POLA EDYTOWALNE PRZEZ TRENERKĘ */}
      <div className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold">Dane kontaktowe i prezentacja</h2>
        <p className="mb-4 text-xs text-muted">Te informacje możesz edytować sama.</p>
        <ProfileForm
          initial={{
            bio: trainer.bio ?? "",
            phone: trainer.phone ?? "",
            instagram: trainer.instagram ?? "",
            facebook: trainer.facebook ?? "",
            website: trainer.website ?? "",
            avatarUrl: trainer.avatarUrl ?? "",
          }}
        />
      </div>
    </div>
  );
}
