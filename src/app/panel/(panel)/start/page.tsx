import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingState, STAGE_LABEL } from "@/lib/onboarding";
import { IconCheck } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Ekran startowy akademii — jedyna strona panelu, którą widzi konto tuż po samodzielnej
 * rejestracji. Odpowiada na pytanie, które pada w tym miejscu zawsze: „założyłam konto,
 * to co teraz?”. Pokazuje stan procesu i rozdziela go na „to robisz Ty” / „to robimy my”,
 * żeby cisza po naszej stronie nie wyglądała jak zepsuta aplikacja.
 */
export default async function PanelStartPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "trenerka" || !user.trainerId) redirect("/panel/login");

  const state = await getOnboardingState(user.trainerId);
  if (!state) redirect("/panel/login");

  const { stage, steps, ownTodo, trainer } = state;
  const label = STAGE_LABEL[stage];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="max-w-3xl">
      <span className="inline-block rounded-full bg-sand-200 px-3 py-1 text-xs font-semibold text-ink-soft">
        {label.badge}
      </span>
      <h1 className="mt-3 font-serif text-2xl font-bold">{label.headline}</h1>
      <p className="mt-2 text-muted">{label.note}</p>

      {ownTodo > 0 && (
        <div className="mt-6 rounded-[12px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>
            {ownTodo === 1 ? "Została jedna rzecz po Twojej stronie." : `Po Twojej stronie zostały ${ownTodo} rzeczy.`}
          </strong>{" "}
          Reszta jest u nas — nie musisz o nią prosić ani pilnować.
        </div>
      )}

      <div className="card mt-6 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-lg font-semibold">Twój postęp</h2>
          <span className="text-sm text-muted">
            {doneCount} z {steps.length}
          </span>
        </div>

        <ol className="mt-5 space-y-5">
          {steps.map((step) => (
            <li key={step.key} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  step.done ? "bg-money-bg text-money-dark" : "border border-sand-300 bg-white text-sand-500"
                }`}
              >
                {step.done ? <IconCheck width={16} height={16} /> : <span className="text-xs">•</span>}
              </span>
              <div className="min-w-0">
                <p className={`font-medium ${step.done ? "text-muted line-through decoration-sand-400" : "text-ink"}`}>
                  {step.title}
                  {!step.done && step.owner === "my" && (
                    <span className="ml-2 rounded bg-sand-100 px-1.5 py-0.5 text-xs font-normal text-muted">
                      robimy my
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted">{step.description}</p>
                {step.href && (
                  <Link href={step.href} className="mt-2 inline-block text-sm font-medium underline">
                    {step.linkLabel ?? "Przejdź"}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {stage === "zgloszenie" && (
        <div className="card mt-6 p-6">
          <h2 className="font-serif text-lg font-semibold">Dlaczego nie widzisz jeszcze kursantek</h2>
          <p className="mt-2 text-sm text-muted">
            Zgłoszenie kursantki to jej imię, telefon i adres e-mail. Przekazanie takich danych wymaga podstawy
            prawnej, a tą jest podpisana umowa partnerska — nie samo założenie konta. Dlatego zakładka z kursantkami
            odblokowuje się po rozmowie i umowie, a nie wcześniej.
          </p>
          <p className="mt-3 text-sm text-muted">
            Masz pytania albo chcesz przyspieszyć?{" "}
            <a href="mailto:biuro@uniwersytetbeauty.pl" className="underline">
              biuro@uniwersytetbeauty.pl
            </a>
          </p>
        </div>
      )}

      {stage !== "zgloszenie" && (
        <div className="mt-6">
          <Link href="/panel/leady" className="btn-primary inline-block">
            Przejdź do kursantek
          </Link>
        </div>
      )}

      <p className="mt-8 text-xs text-muted">
        Konto: {user.email} · Profil: {trainer.name}
      </p>
    </div>
  );
}
