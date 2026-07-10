import Link from "next/link";
import { JsonLd } from "./JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";

export function Breadcrumbs({ items }: { items: { name: string; url: string }[] }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items)} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={item.url} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                {last ? (
                  <span aria-current="page" className="text-ink-soft font-medium">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.url} className="hover:text-sand-700 transition-colors">
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
