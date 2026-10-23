"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SafetyTab = { href: string; label: string };

export function SafetyTabs({ tabs }: { tabs: readonly SafetyTab[] }) {
  const pathname = usePathname();
  // Gana la pestaña más específica: «Casos» (la raíz) no queda activa en las demás.
  const current = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((x, y) => y.href.length - x.href.length)[0];
  return (
    <nav aria-label="Accidentabilidad" className="flex flex-wrap gap-1 border-b border-[var(--color-line)]">
      {tabs.map((tab) => {
        const active = tab === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
              active
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
