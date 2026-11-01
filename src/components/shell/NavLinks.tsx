"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/shell/nav-config";

/** Pestañas horizontales del encabezado. El primer ítem es la raíz: solo activo en coincidencia exacta. */
export function NavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  const rootHref = items[0]?.href;
  const isActive = (href: string) =>
    href === rootHref
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <ul className="flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
                active
                  ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
