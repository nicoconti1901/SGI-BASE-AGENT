"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type MasterDataTab = { href: string; label: string };

export function MasterDataTabs({ tabs }: { tabs: readonly MasterDataTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Datos maestros" className="flex flex-wrap gap-1 border-b border-[var(--color-line)]">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
