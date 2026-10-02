import Link from "next/link";
import { getDb } from "@/db";
import { requireSuperadminPage } from "@/lib/auth";
import { listTeam } from "@/lib/team";
import { TeamManager } from "@/components/admin/TeamManager";

export const dynamic = "force-dynamic";

export default async function ZespolPage() {
  await requireSuperadminPage(); // PRZED jakimkolwiek zapytaniem — zespół tylko dla superadmina
  const members = await listTeam(await getDb());

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">
          Zespół <span className="text-base font-normal text-muted">({members.length})</span>
        </h1>
        <Link href="/admin/zespol/log" className="btn-outline !px-4 !py-2 !text-sm">Dziennik zmian →</Link>
      </div>
      <div className="mt-6">
        <TeamManager
          members={members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
