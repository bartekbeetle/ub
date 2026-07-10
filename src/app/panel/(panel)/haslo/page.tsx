import { PanelPasswordForm } from "@/components/panel/PanelPasswordForm";

export default function PanelZmianaHaslaPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Zmiana hasła</h1>
      <div className="card mt-6 p-6">
        <PanelPasswordForm />
      </div>
    </div>
  );
}
