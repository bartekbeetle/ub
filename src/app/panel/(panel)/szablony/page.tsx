import { requireTrainerPage } from "@/lib/crm-page";
import { listTemplates } from "@/lib/crm-core";
import { getDb } from "@/db";
import { TemplateManager } from "@/components/panel/crm/TemplateManager";

export const dynamic = "force-dynamic";

export default async function SzablonyPage() {
  const { trainerId } = await requireTrainerPage();
  const templates = await listTemplates(await getDb(), trainerId);
  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-2xl font-bold">Szablony wiadomości</h1>
      <p className="mt-2 mb-6 text-sm text-muted">
        Gotowe treści do wiadomości e-mail i SMS. Znaczniki <code>{"{imie}"}</code> i <code>{"{kurs}"}</code> podstawiają się przy wysyłce do konkretnej kursantki. Szablony widzisz tylko Ty.
      </p>
      <TemplateManager
        templates={templates.map((t) => ({ id: t.id, channel: t.channel === "sms" ? "sms" : "email", name: t.name, subject: t.subject, body: t.body }))}
      />
    </div>
  );
}
