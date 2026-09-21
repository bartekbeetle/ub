import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Trainer } from "@/db/schema";
import type { ProspectRow } from "./prospects";

/**
 * STAN ONBOARDINGU AKADEMII — jedno miejsce, z którego czyta i panel, i bramki dostępu.
 *
 * Skąd się to bierze: od `/dla-akademii/rejestracja` akademia zakłada konto SAMA, więc
 * w bazie pojawia się wiersz `trainers`, zanim ktokolwiek z nami rozmawiał i zanim jest umowa.
 * Schemat `prospects` opisuje regułę odwrotną („profil powstaje dopiero PO umowie") i ta reguła
 * dalej obowiązuje dla KATALOGU PUBLICZNEGO — dlatego konto z rejestracji dostaje
 * `isActive: false`, co znaczy dokładnie tyle:
 *
 *   konto istnieje · profil NIE jest publiczny · `distributeLead` (matching.ts) je pomija
 *   · panel nie pokazuje ani jednego rekordu kursantki.
 *
 * Bramka danych osobowych nie przesunęła się więc ani o milimetr: dopóki człowiek nie
 * zweryfikuje wpisu do BUR i nie podpisze umowy, akademia widzi wyłącznie swoje własne dane.
 */

export type OnboardingStage = "zgloszenie" | "weryfikacja" | "aktywna";

export type OnboardingStep = {
  key: string;
  title: string;
  description: string;
  done: boolean;
  /** Krok, który akademia może wykonać sama (ma link) — reszta dzieje się po naszej stronie. */
  href?: string;
  linkLabel?: string;
  owner: "akademia" | "my";
};

export type OnboardingState = {
  trainer: Trainer;
  prospect: ProspectRow | null;
  stage: OnboardingStage;
  steps: OnboardingStep[];
  /** Ile kroków „po stronie akademii" zostało do odhaczenia — do nagłówka i licznika. */
  ownTodo: number;
};

/** Profil uznajemy za uzupełniony, gdy da się z niego napisać wiarygodne przedstawienie akademii. */
const MIN_BIO_LENGTH = 120;

export function isProfileComplete(trainer: Trainer): boolean {
  return (
    (trainer.bio?.trim().length ?? 0) >= MIN_BIO_LENGTH &&
    Boolean(trainer.phone?.trim()) &&
    trainer.specializations.length > 0
  );
}

export async function getOnboardingState(trainerId: number): Promise<OnboardingState | null> {
  const db = await getDb();
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, trainerId)).limit(1);
  if (!trainer) return null;

  // Prospekt to nasza strona lejka (rozmowy, weryfikacja BUR, status umowy). Nie każda trenerka
  // go ma — konta założone ręcznie przed wrześniem 2026 istnieją bez wiersza w `prospects`.
  const [prospect] = await db
    .select()
    .from(schema.prospects)
    .where(eq(schema.prospects.trainerId, trainerId))
    .limit(1);

  const profileDone = isProfileComplete(trainer);
  const burConfirmed = prospect?.burSegment === "A" && Boolean(prospect?.burCheckedAt);
  const talked = Boolean(prospect?.lastContactAt);
  // Umowa = `autoAssign`. To nie jest skrót myślowy: ta flaga jest w schemacie zdefiniowana
  // jako bramka umowy i tylko ona decyduje, czy automat wyda dane osobowe kursantki.
  const contractDone = trainer.autoAssign;

  const stage: OnboardingStage = !trainer.isActive
    ? "zgloszenie"
    : contractDone
      ? "aktywna"
      : "weryfikacja";

  const steps: OnboardingStep[] = [
    {
      key: "konto",
      title: "Konto założone",
      description: "Masz dostęp do panelu. Hasło zmienisz w każdej chwili.",
      done: true,
      owner: "akademia",
    },
    {
      key: "profil",
      title: "Uzupełnij profil akademii",
      description:
        "Opis (min. 120 znaków), telefon i zakres szkoleń. Z tego korzystamy, kiedy dobieramy kursantkę — im konkretniej, tym trafniej.",
      done: profileDone,
      href: "/panel/profil",
      linkLabel: profileDone ? "Sprawdź profil" : "Uzupełnij profil",
      owner: "akademia",
    },
    {
      key: "bur",
      title: "Weryfikacja wpisu do Bazy Usług Rozwojowych",
      description: burConfirmed
        ? "Potwierdzone w karcie dostawcy PARP."
        : "Sprawdzamy Twój wpis w rejestrze PARP. Bez niego kursantka nie rozliczy dofinansowania — dlatego robimy to przed przekazaniem pierwszego kontaktu.",
      done: burConfirmed,
      owner: "my",
    },
    {
      key: "rozmowa",
      title: "Rozmowa z nami",
      description: talked
        ? "Rozmawialiśmy — dalsze ustalenia znajdziesz w mailu."
        : "Dzwonimy w ciągu 1–2 dni roboczych. Ustalamy zakres, region i zasady rozliczenia.",
      done: talked,
      owner: "my",
    },
    {
      key: "umowa",
      title: "Umowa partnerska",
      description: contractDone
        ? "Umowa podpisana — możemy przekazywać Ci dane kontaktowe kursantek."
        : "Do czasu podpisania umowy nie przekazujemy Ci danych osobowych kursantek. Tak wymaga RODO i tak to zostaje.",
      done: contractDone,
      owner: "my",
    },
    {
      key: "leady",
      title: "Dostajesz kursantki",
      description:
        "Zgłoszenia z Twojego regionu i Twojej kategorii trafiają do zakładki „Moje kursantki”.",
      done: stage === "aktywna",
      owner: "my",
    },
  ];

  return {
    trainer,
    prospect: (prospect as ProspectRow) ?? null,
    stage,
    steps,
    ownTodo: steps.filter((s) => s.owner === "akademia" && !s.done).length,
  };
}

/** Krótki opis etapu do nagłówka panelu — ta sama treść w kilku miejscach, więc trzymana raz. */
export const STAGE_LABEL: Record<OnboardingStage, { badge: string; headline: string; note: string }> = {
  zgloszenie: {
    badge: "Zgłoszenie w weryfikacji",
    headline: "Jesteś w kolejce — odezwiemy się telefonicznie",
    note: "Konto działa, ale kursantek jeszcze nie przekazujemy. Najpierw sprawdzamy wpis do BUR i ustalamy warunki przez telefon.",
  },
  weryfikacja: {
    badge: "Po weryfikacji, przed umową",
    headline: "Profil zweryfikowany — zostaje umowa",
    note: "Do czasu podpisania umowy kursantki przekazujemy wyłącznie ręcznie, po Twojej zgodzie na konkretny kontakt.",
  },
  aktywna: {
    badge: "Konto aktywne",
    headline: "Wszystko gotowe — zgłoszenia trafiają do Ciebie automatycznie",
    note: "Kursantki z Twojego regionu i kategorii widzisz w zakładce „Moje kursantki”.",
  },
};
