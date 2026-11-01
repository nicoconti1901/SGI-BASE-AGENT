"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { crumbsFor, type TrailIndex } from "@/domain/modules/hub";

/** Ruta del encabezado: Inicio › Módulo › Pantalla. Cada tramo vuelve a su nivel. */
export function ShellTrail({ index }: { index: TrailIndex }) {
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname, index);

  return (
    <nav aria-label="Ruta" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 overflow-x-auto text-sm">
        {crumbs.map((crumb, i) => {
          const current = crumb.href === pathname;
          return (
            <li key={crumb.href} className="flex shrink-0 items-center gap-1.5">
              {i > 0 ? (
                <span
                  aria-hidden
                  className="font-[family-name:var(--font-mono)] text-[var(--color-ink-subtle)]"
                >
                  ›
                </span>
              ) : null}
              {current ? (
                <span
                  aria-current="page"
                  className="rounded-[var(--radius-sm)] px-1.5 py-1 font-semibold"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="rounded-[var(--radius-sm)] px-1.5 py-1 text-[var(--color-ink-muted)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
