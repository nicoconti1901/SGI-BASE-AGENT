"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/shell/nav-config";

export function NavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  // El primer item es la raíz de la sección: solo activo en coincidencia exacta.
  const isActive = (href: string, index: number) =>
    index === 0 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {items.map((item, index) => {
        const active = isActive(item.href, index);
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
    </>
  );
}
