import { TrainerForm } from "@/components/admin/TrainerForm";

export default function NowaTrenerkaPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Dodaj trenerkę</h1>
      <div className="card mt-6 p-6">
        <TrainerForm />
      </div>
    </div>
  );
}
