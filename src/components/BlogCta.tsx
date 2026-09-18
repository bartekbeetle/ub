import Link from "next/link";
import { IconArrowRight } from "@/components/icons";

/**
 * CTA wstrzykiwane w artykuły bloga — dwa razy na wpis (w środku treści i na końcu),
 * patrz `src/app/(public)/blog/[slug]/page.tsx`. Zawsze prowadzi do quizu kwalifikacyjnego:
 * decyzja właściciela 13.09.2026, cały ruch ma iść w jeden lejek.
 *
 * `variant="inline"` jest lżejszy (czyta się jako część artykułu, nie jak reklama wbita
 * w środek zdania), `variant="end"` jest pełnym blokiem zamykającym z dwoma linkami.
 */
export function BlogCta({ variant = "inline" }: { variant?: "inline" | "end" }) {
  if (variant === "end") {
    return (
      <aside className="card mt-12 bg-cream-warm p-8 text-center">
        <h2 className="font-serif text-2xl font-bold">Gotowa na start w beauty?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Odpowiedz na kilka pytań — sprawdzimy Twoje dofinansowanie i pomożemy Ci przejść przez cały proces.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/aplikacja" className="btn-primary">Złóż aplikację</Link>
          <Link href="/kursy" className="btn-outline">Przeglądaj kursy</Link>
        </div>
      </aside>
    );
  }

  return (
    <aside className="my-8 flex flex-col items-start gap-3 rounded-[12px] border-2 border-sand-200 bg-sand-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-ink-soft">
        Chcesz sprawdzić, ile dofinansowania dostaniesz na szkolenie beauty?
      </p>
      <Link href="/aplikacja" className="btn-primary shrink-0 whitespace-nowrap !px-5 !py-2.5 !text-sm">
        Aplikuj teraz <IconArrowRight width={16} height={16} />
      </Link>
    </aside>
  );
}
