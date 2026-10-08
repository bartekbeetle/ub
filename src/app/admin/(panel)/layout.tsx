import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { isAdminRole, isSuperadminRole, canAccessAdminPath } from "@/lib/roles";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { PanelShell } from "@/components/PanelShell";
import { telefonEnabled } from "@/lib/telefon/flag";

export const dynamic = "force-dynamic";

const HASLO = "/admin/haslo";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.role)) redirect("/admin/login");

  // 🔴 Przekierowanie, nie podmiana widoku — pełne uzasadnienie w layoucie panelu trenerki
  // (`src/app/panel/(panel)/layout.tsx`). Skrótowo: samo nierenderowanie `children` NIE
  // powstrzymuje Nexta przed wykonaniem segmentu strony i wrzuceniem danych do payloadu RSC.
  if (user.mustChangePassword) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (pathname !== HASLO) redirect(HASLO);
  }

  // Rozliczenia, ustawienia i zespół są tylko dla superadmina. To pierwsza linia obrony
  // (przekierowanie, nie podmiana widoku); druga to `requireSuperadminPage()` w samych
  // stronach i `requireSuperadmin()` w trasach API — strona renderuje się równolegle
  // z layoutem, więc same przekierowanie stąd nie powstrzymałoby jej zapytań do bazy.
  {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!canAccessAdminPath(user.role, pathname)) redirect("/admin");
  }

  return (
    <PanelShell
      brandHref="/admin"
      brand={
        <>
          UB <span className="text-sand-300">{isSuperadminRole(user.role) ? "SUPERADMIN" : "ADMIN"}</span>
        </>
      }
      nav={<AdminNav isSuperadmin={isSuperadminRole(user.role)} telefon={telefonEnabled()} />}
      footer={
        <>
          <p className="truncate px-4 pb-2 text-xs text-sand-200/50">{user.email}</p>
          <Link
            href="/admin/haslo"
            className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-sand-200/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Zmień hasło
          </Link>
          <LogoutButton />
        </>
      }
    >
      {user.mustChangePassword && (
        <div className="mx-auto mb-6 max-w-md rounded-[12px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Zmień hasło startowe.</strong> Konto używa hasła z seeda. Ustaw własne hasło,
          żeby uzyskać dostęp do panelu.
        </div>
      )}
      {children}
    </PanelShell>
  );
}
