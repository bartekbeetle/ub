"use client";

import { trackEvent } from "@/lib/tracking-events";

/**
 * Link „Kupuję…" do zewnętrznej płatności (naffy) — odpala `begin_checkout` (Meta
 * `InitiateCheckout` + GA4 `begin_checkout`) w chwili kliknięcia, PRZED przejściem na inną
 * domenę. Strona-rodzic (`poradnik-wlasny-salon/page.tsx`) jest Server Componentem, więc
 * `onClick` potrzebuje osobnego klienckiego komponentu — świadomie NIE `preventDefault`:
 * `fbq`/`gtag` to synchroniczne wywołania (beacon/keepalive po stronie tych bibliotek),
 * nawigacja do naffy nie musi na nie czekać.
 */
export function CheckoutLink({
  href,
  contentName,
  value,
  className,
  children,
}: {
  href: string;
  contentName: string;
  value: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      rel="noopener"
      className={className}
      onClick={() => trackEvent("begin_checkout", { content_name: contentName, value, currency: "PLN" })}
    >
      {children}
    </a>
  );
}
