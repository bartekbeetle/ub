import Link from "next/link";
import { ProspectForm } from "@/components/admin/ProspectForm";

export const dynamic = "force-dynamic";

export default function NowyProspektPage() {
  return (
    <div>
      <Link href="/admin/crm-trenerki" className="text-sm font-semibold text-sand-700 hover:underline">← Wróć do CRM</Link>
      <h1 className="mt-3 font-serif text-2xl font-bold">Nowy prospekt</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Wpis trafia wyłącznie do wewnętrznego pipeline&apos;u. Publiczny profil w katalogu trenerek tworzysz osobno,
        dopiero przy statusie „Umowa”.
      </p>
      <div className="mt-6">
        <ProspectForm />
      </div>
    </div>
  );
}
