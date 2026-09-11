import { redirect, notFound } from "next/navigation";

/**
 * Karta leada mieszka teraz pod /admin/kursantki/[id]. Stary adres przekierowuje —
 * linki do konkretnych leadów wychodziły w mailach i zostały w zakładkach.
 */
export default async function LeadDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Number.isInteger(Number(id))) notFound();
  redirect(`/admin/kursantki/${Number(id)}`);
}
