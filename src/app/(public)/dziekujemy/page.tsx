import type { Metadata } from "next";
import Link from "next/link";
import { TrackEvent } from "@/components/TrackEvent";
import { IconCheck } from "@/components/icons";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Dziękujemy za zgłoszenie | ${SITE_NAME}`,
  robots: { index: false },
};

export default function DziekujemyPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center md:py-28">
      {/* Meta Pixel: event konwersji Lead */}
      <TrackEvent event="Lead" />
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-money-bg text-money">
        <IconCheck width={40} height={40} />
      </span>
      <h1 className="mt-8 text-3xl font-bold md:text-4xl">Dziękujemy!</h1>
      <p className="mt-4 text-lg text-muted">
        Twoje zgłoszenie dotarło do nas. <strong className="text-ink-soft">Skontaktujemy się w ciągu 24h</strong>,
        żeby omówić Twoje dofinansowanie i dobrać najlepsze szkolenie.
      </p>
      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/blog" className="btn-primary">Poczytaj bazę wiedzy</Link>
        <Link href="/kursy" className="btn-outline">Przeglądaj kursy</Link>
      </div>
    </div>
  );
}
