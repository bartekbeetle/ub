import { redirect } from "next/navigation";

// `/admin/skrzynka` = odebrane. Osobna trasa folderu trzyma jeden widok dla obu list.
export default function SkrzynkaIndex() {
  redirect("/admin/skrzynka/odebrane");
}
