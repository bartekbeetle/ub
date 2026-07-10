import { PasswordForm } from "@/components/admin/PasswordForm";

export default function ZmianaHaslaPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Zmiana hasła</h1>
      <div className="card mt-6 p-6">
        <PasswordForm />
      </div>
    </div>
  );
}
