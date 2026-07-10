import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { PanelNav } from "@/components/panel/PanelNav";
import { PanelLogoutButton } from "@/components/panel/PanelLogoutButton";

export const dynamic = "force-dynamic";

export default async function TrainerPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || user.role !== "trenerka" || !user.trainerId) redirect("/panel/login");

  const db = await getDb();
  const [trainer] = await db
    .select({ name: schema.trainers.name })
    .from(schema.trainers)
    .where(eq(schema.trainers.id, user.trainerId))
    .limit(1);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* SIDEBAR navy */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-navy px-3 py-6">
        <Link href="/panel/leady" className="px-4 font-serif text-lg font-bold tracking-[3px] text-cream-warm">
          UB <span className="text-sand-300">PANEL</span>
        </Link>
        <div className="mt-8 flex-1">
          <PanelNav />
        </div>
        <div className="border-t border-white/10 pt-3">
          <p className="truncate px-4 pb-0.5 text-xs font-semibold text-sand-200/80">{trainer?.name ?? "Trenerka"}</p>
          <p className="truncate px-4 pb-2 text-xs text-sand-200/50">{user.email}</p>
          <Link href="/panel/haslo" className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-sand-200/70 transition-colors hover:bg-white/5 hover:text-white">
            Zmień hasło
          </Link>
          <PanelLogoutButton />
        </div>
      </aside>

      <div className="ml-60 flex-1 p-8">
        {user.mustChangePassword && (
          <div className="mb-6 rounded-[12px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <strong>Zmień hasło startowe.</strong> Twoje konto używa hasła tymczasowego —{" "}
            <Link href="/panel/haslo" className="font-semibold underline">ustaw własne hasło teraz</Link>.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
