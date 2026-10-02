import { TrainerForm } from "@/components/admin/TrainerForm";
import { getSessionUser } from "@/lib/auth";
import { isSuperadminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function NowaTrenerkaPage() {
  const user = await getSessionUser();
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Dodaj trenerkę</h1>
      <div className="card mt-6 p-6">
        <TrainerForm canEditBilling={isSuperadminRole(user?.role)} />
      </div>
    </div>
  );
}
