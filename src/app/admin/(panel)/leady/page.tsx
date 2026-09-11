import { redirect } from "next/navigation";

/**
 * Lista leadów przeniesiona do jednego okna „Kursantki" (leady + zgłoszenia razem).
 * Trasa zostaje jako przekierowanie — adres krąży w zakładkach i starych powiadomieniach.
 */
export default function LeadyRedirect() {
  redirect("/admin/kursantki?typ=lead");
}
