import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "admin") redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <p className="text-center font-serif text-xl font-bold tracking-[3px] text-cream-warm">
          UB <span className="text-sand-300">ADMIN</span>
        </p>
        <div className="card mt-6 p-8">
          <h1 className="font-serif text-xl font-bold">Logowanie</h1>
          <p className="mb-6 mt-1 text-sm text-muted">Panel administracyjny Uniwersytet Beauty</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
