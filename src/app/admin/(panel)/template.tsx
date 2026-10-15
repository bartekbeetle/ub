import { ViewEnter } from "@/components/ui/ViewMotion";

/** Next montuje template od nowa przy każdej zmianie zakładki — stąd kaskada wejścia na każdym widoku. */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <ViewEnter>{children}</ViewEnter>;
}
