"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/domain/modules/catalog";

export function NavLinks({ sections }: { sections: readonly NavSection[] }) {
  const pathname = usePathname();
  // El primer item es la raíz de la sección: solo activo en coincidencia exacta.
  const rootHref = sections[0]?.items[0]?.href;
  const isActive = (href: string) =>
    href === rootHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {sections.map((section, index) => {
        const headingId = section.label ? `nav-seccion-${index}` : undefined;
        return (
          <div
            key={section.label ?? `sin-rotulo-${index}`}
            role={section.label ? "group" : undefined}
            aria-labelledby={headingId}
            className={`flex flex-col gap-1 ${index > 0 ? "mt-3" : ""}`}
          >
            {section.label ? (
              <p
                id={headingId}
                className="px-3 pb-1 font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.12em] opacity-60"
              >
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-white/10 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    active ? "bg-white/15 opacity-100" : "opacity-80"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
