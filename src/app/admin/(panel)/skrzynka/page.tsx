import { redirect } from "next/navigation";
import { inboxConfigured } from "@/lib/inbox";

// `/admin/skrzynka` = odebrane `biuro@`; gdy nie jest podpięte, od razu odpowiedzi na automaty (`szkolenia@`).
export default function SkrzynkaIndex() {
  redirect(inboxConfigured() ? "/admin/skrzynka/odebrane" : "/admin/skrzynka/automat");
}
