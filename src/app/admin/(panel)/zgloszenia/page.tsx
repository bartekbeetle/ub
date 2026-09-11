import { redirect } from "next/navigation";

/**
 * Zgłoszenia nie mają już własnej listy — siedzą w jednym oknie „Kursantki",
 * razem z leadami, z przyciskiem „Uzupełnij do leada" na każdym wierszu.
 */
export default function ZgloszeniaRedirect() {
  redirect("/admin/kursantki?typ=zgloszenie");
}
