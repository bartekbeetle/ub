import type { Metadata } from "next";

/**
 * Druga warstwa ochrony panelu trenerki — obok `Disallow: /panel` w robots.txt.
 *
 * robots.txt mówi tylko „nie skanuj"; nie zapobiega zaindeksowaniu adresu, który wyszukiwarka
 * pozna z innego źródła (link, historia przeglądarki, pasek adresu). Meta `noindex` jest wiążący.
 * Panel wyświetla dane osobowe leadów (imię, telefon, e-mail kursantek), więc dublujemy warstwy
 * dokładnie tak, jak jest to zrobione dla `/admin`.
 *
 * Layout siedzi na poziomie `panel/`, a nie w grupie `(panel)/`, żeby objąć też `/panel/login`.
 */
export const metadata: Metadata = {
  title: "Panel trenerki — Uniwersytet Beauty",
  robots: { index: false, follow: false, nocache: true },
};

export default function TrainerPanelRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
