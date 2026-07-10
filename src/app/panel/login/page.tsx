import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { PanelLoginForm } from "@/components/panel/PanelLoginForm";

export const dynamic = "force-dynamic";

export default async function PanelLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "trenerka" && user.trainerId) redirect("/panel/leady");
  if (user?.role === "admin") redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <p className="text-center font-serif text-xl font-bold tracking-[3px] text-cream-warm">
          UB <span className="text-sand-300">PANEL TRENERKI</span>
        </p>
        <div className="card mt-6 p-8">
          <h1 className="font-serif text-xl font-bold">Logowanie</h1>
          <p className="mb-6 mt-1 text-sm text-muted">Panel trenerki Uniwersytet Beauty</p>
          <PanelLoginForm />
        </div>
      </div>
    </div>
  );
}
