"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type InspectionTab = { href: string; label: string };

export function InspectionTabs({ tabs }: { tabs: readonly InspectionTab[] }) {
  const pathname = usePathname();
  // La pestaña «Inspecciones» no debe quedar activa cuando se está en una ruta hermana (Activos).
  const active = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav aria-label="Inspecciones" className="flex flex-wrap gap-1 border-b border-[var(--color-line)]">
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
              isActive
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
