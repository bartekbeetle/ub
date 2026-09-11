import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SubmissionConversionForm } from "@/components/admin/SubmissionConversionForm";
import { formatDateTime } from "@/lib/utils";
import { SUBMISSION_TYPE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function KonwersjaZgloszeniaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submissionId = Number(id);
  if (!Number.isInteger(submissionId)) notFound();

  const db = await getDb();
  const [submission] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.id, submissionId))
    .limit(1);
  if (!submission) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/kursantki" className="text-sm font-semibold text-sand-700 hover:underline">
        ← Wróć do Kursantek
      </Link>
      <h1 className="mt-3 font-serif text-2xl font-bold">Uzupełnij zgłoszenie #{submission.id} do leada</h1>
      <p className="mt-1 text-sm text-muted">
        Zgłoszenie zostaje w bazie jako ślad — powstaje z niego nowy lead, gotowy do przydziału trenerce.
      </p>

      {/* CO JUŻ MAMY */}
      <div className="card mt-6 p-5">
        <h2 className="font-serif text-lg font-semibold">Treść zgłoszenia</h2>
        <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Typ</dt>
          <dd><span className="badge-tag">{SUBMISSION_TYPE_LABELS[submission.type] ?? submission.type}</span></dd>
          <dt className="text-muted">Wpłynęło</dt>
          <dd>{formatDateTime(submission.createdAt)}</dd>
          <dt className="text-muted">E-mail</dt>
          <dd>{submission.email}</dd>
          <dt className="text-muted">Telefon</dt>
          <dd>{submission.phone ?? "— brak —"}</dd>
          <dt className="text-muted">Wiadomość</dt>
          <dd className="whitespace-pre-line">{submission.message ?? "—"}</dd>
        </dl>
      </div>

      {submission.convertedToLeadId ? (
        <div className="card mt-6 border border-emerald-200 bg-emerald-50/60 p-5">
          <h2 className="font-serif text-lg font-semibold">To zgłoszenie jest już przekonwertowane</h2>
          <p className="mt-2 text-sm">
            {formatDateTime(submission.convertedAt)} powstał z niego{" "}
            <Link
              href={`/admin/kursantki/${submission.convertedToLeadId}`}
              className="font-semibold text-sand-700 hover:underline"
            >
              lead #{submission.convertedToLeadId}
            </Link>
            . Drugiego leada z tego samego zgłoszenia system nie utworzy.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <SubmissionConversionForm submission={submission} />
        </div>
      )}
    </div>
  );
}
