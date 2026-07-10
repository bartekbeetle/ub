import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-serif text-7xl font-bold text-sand-300">404</p>
        <h1 className="mt-4 text-2xl font-bold md:text-3xl">Ta strona nie istnieje</h1>
        <p className="mt-3 text-muted">
          Strona mogła zostać przeniesiona albo adres zawiera literówkę. Sprawdź nasze szkolenia albo wróć na
          stronę główną.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="btn-primary">Strona główna</Link>
          <Link href="/kursy" className="btn-outline">Zobacz kursy</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
