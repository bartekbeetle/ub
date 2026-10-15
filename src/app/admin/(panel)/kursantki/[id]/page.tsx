import { LeadDetail } from "@/components/admin/LeadDetail";

export const dynamic = "force-dynamic";

/** Pełna podstrona kursantki — zostaje dla linków z maili i otwierania w nowej karcie. Z listy otwiera się panel. */
export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetail leadId={Number(id)} />;
}
