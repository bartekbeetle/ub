import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* SIDEBAR navy */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-navy px-3 py-6">
        <Link href="/admin" className="px-4 font-serif text-lg font-bold tracking-[3px] text-cream-warm">
          UB <span className="text-sand-300">ADMIN</span>
        </Link>
        <div className="mt-8 flex-1">
          <AdminNav />
        </div>
        <div className="border-t border-white/10 pt-3">
          <p className="truncate px-4 pb-2 text-xs text-sand-200/50">{user.email}</p>
          <Link href="/admin/haslo" className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-sand-200/70 transition-colors hover:bg-white/5 hover:text-white">
            Zmień hasło
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <div className="ml-60 flex-1 p-8">
        {user.mustChangePassword && (
          <div className="mb-6 rounded-[12px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <strong>Zmień hasło startowe.</strong> Konto używa hasła z seeda —{" "}
            <Link href="/admin/haslo" className="font-semibold underline">ustaw własne hasło teraz</Link>.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
