import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main id="tresc">{children}</main>
      <Footer />
      {/* Sticky CTA na mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <Link href="/konsultacja" className="btn-primary w-full !py-3 text-center">
          Bezpłatna Konsultacja
        </Link>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </>
  );
}
