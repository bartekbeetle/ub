import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { PanelNav } from "@/components/panel/PanelNav";
import { PanelLogoutButton } from "@/components/panel/PanelLogoutButton";
import { PanelShell } from "@/components/PanelShell";

export const dynamic = "force-dynamic";

const HASLO = "/panel/haslo";

export default async function TrainerPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || user.role !== "trenerka" || !user.trainerId) redirect("/panel/login");

  /**
   * 🔴 Wymuszona zmiana hasła = PRZEKIEROWANIE, nie podmiana tego, co widać.
   *
   * Poprzednia wersja renderowała zamiast `children` formularz zmiany hasła i zakładała,
   * że dane kandydatek nigdzie nie trafiają. Sprawdzone 21.09.2026 na żywym panelu:
   * **trafiały**. Next renderuje segment strony równolegle z layoutem, więc `/panel/leady`
   * wykonywało się mimo wszystko, a adresy e-mail i telefony kandydatek lądowały
   * w payloadzie RSC (`__next_f`) w źródle strony. Nie było ich widać, ale wystarczyło
   * otworzyć źródło. Dotyczyło to konta, które wciąż ma wspólne hasło startowe.
   *
   * `redirect()` przerywa renderowanie całego drzewa i odsyła 307 bez treści — dane nie
   * mają jak wyciec. Stronę zmiany hasła wyłączamy z reguły, inaczej powstaje pętla;
   * ścieżkę podaje middleware nagłówkiem `x-pathname`.
   */
  if (user.mustChangePassword) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (pathname !== HASLO) redirect(HASLO);
  }

  const db = await getDb();
  const [trainer] = await db
    .select({ name: schema.trainers.name, isActive: schema.trainers.isActive })
    .from(schema.trainers)
    .where(eq(schema.trainers.id, user.trainerId))
    .limit(1);
  // Konto po samodzielnej rejestracji, przed aktywacją — patrz `@/lib/onboarding`.
  const pending = !trainer?.isActive;

  return (
    <PanelShell
      brandHref={pending ? "/panel/start" : "/panel/leady"}
      brand={
        <>
          UB <span className="text-sand-300">PANEL</span>
        </>
      }
      nav={<PanelNav pending={pending} />}
      footer={
        <>
          <p className="truncate px-4 pb-0.5 text-xs font-semibold text-sand-200/80">
            {trainer?.name ?? "Trenerka"}
          </p>
          <p className="truncate px-4 pb-2 text-xs text-sand-200/50">{user.email}</p>
          <Link
            href="/panel/haslo"
            className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-sand-200/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Zmień hasło
          </Link>
          <PanelLogoutButton />
        </>
      }
    >
      {user.mustChangePassword && (
        <div className="mx-auto mb-6 max-w-md rounded-[12px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Zmień hasło startowe.</strong> Twoje konto używa hasła tymczasowego. Ustaw
          własne hasło, żeby uzyskać dostęp do panelu i danych kandydatek.
        </div>
      )}
      {children}
    </PanelShell>
  );
}
