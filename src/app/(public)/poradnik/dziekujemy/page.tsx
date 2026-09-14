import type { Metadata } from "next";
import Link from "next/link";
import { IconCheck } from "@/components/icons";
import { TrackEvent } from "@/components/TrackEvent";

export const metadata: Metadata = {
  title: { absolute: "Twój poradnik jest gotowy" },
  // Strona podziękowania nie ma czego robić w indeksie — to koniec ścieżki, nie treść.
  robots: { index: false, follow: true },
};

type Search = Promise<{ w?: string }>;

const WERSJE: Record<string, { nazwa: string; plik: string }> = {
  slaskie: { nazwa: "śląskiego", plik: "/poradniki/poradnik-slaskie.pdf" },
  wielkopolskie: { nazwa: "wielkopolskiego", plik: "/poradniki/poradnik-wielkopolskie.pdf" },
};

export default async function PoradnikDziekujemyPage({ searchParams }: { searchParams: Search }) {
  const { w } = await searchParams;
  // Domyślnie śląskie — lepiej dać cokolwiek do pobrania niż pustą stronę,
  // ale obie wersje i tak są linkowane niżej.
  const wersja = WERSJE[w ?? ""] ?? WERSJE.slaskie;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center md:px-6">
      {/* Zdarzenie osobne od `Lead` — pobranie poradnika to NIE jest lead sprzedażowy
          (brak zgody na przekazanie danych akademii). Mieszanie tych dwóch zdarzeń
          zafałszowałoby optymalizację kampanii i koszt pozyskania leada w Mecie. */}
      <TrackEvent event="CompleteRegistration" params={{ content_name: "poradnik-bur" }} />

      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-money/10">
        <IconCheck width={28} height={28} className="text-money" />
      </div>

      <h1 className="mt-6 text-3xl font-bold">Twój poradnik jest gotowy</h1>
      <p className="mt-3 text-lg text-muted">
        Wydanie dla województwa {wersja.nazwa}. Pobierz go teraz — nie musisz czekać na maila.
      </p>

      <a href={wersja.plik} download className="btn-primary mt-8 inline-flex">
        Pobierz poradnik (PDF)
      </a>

      <p className="mt-6 text-sm text-muted">
        Potrzebujesz wydania dla drugiego województwa?{" "}
        <a
          href={wersja.plik === WERSJE.slaskie.plik ? WERSJE.wielkopolskie.plik : WERSJE.slaskie.plik}
          download
          className="underline hover:text-sand-700"
        >
          Pobierz je tutaj
        </a>
        .
      </p>

      <div className="mt-12 rounded-[12px] border border-sand-200 bg-sand-50 p-6 text-left">
        <h2 className="text-lg font-bold">Chcesz od razu sprawdzić swój poziom dofinansowania?</h2>
        <p className="mt-2 text-muted">
          Poradnik tłumaczy zasady ogólne. Jeśli wolisz od razu wiedzieć, co przysługuje
          konkretnie Tobie, wypełnij krótki formularz — sprawdzimy to i oddzwonimy.
        </p>
        <Link href="/quiz" className="btn-primary mt-5 inline-flex">
          Sprawdź swoje dofinansowanie
        </Link>
      </div>
    </div>
  );
}
