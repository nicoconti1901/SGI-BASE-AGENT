import Link from "next/link";
import { NavLinks } from "@/components/shell/NavLinks";
import { ShellTrail } from "@/components/shell/ShellTrail";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { PERSONA_THEME, type NavItem } from "@/components/shell/nav-config";
import type { TrailIndex } from "@/domain/modules/hub";
import { StatusChip } from "@/components/ui";
import { PERSONA_LABELS, type Persona } from "@/domain/identity/persona";

export type ShellIdentity = {
  persona: Persona;
  name: string;
  email: string;
  roleLabel: string;
  capabilities: { canEdit: boolean; items: string[] };
};

type AppShellProps = {
  identity: ShellIdentity;
  /** Dónde está parado el usuario: "Plataforma" o el nombre de la empresa. */
  contextLabel: string;
  /** Pestañas fijas (plataforma). La empresa navega por el hub y la ruta. */
  navItems?: readonly NavItem[];
  /** Ruta Inicio › Módulo › Pantalla (empresa). */
  trail?: TrailIndex;
  /** Salida a un nivel superior (ej. superusuario dentro de una empresa). */
  backLink?: NavItem;
  children: React.ReactNode;
};

function HexMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 28 24"
      className="h-7 w-8 shrink-0 text-[var(--color-accent)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    >
      <path d="M7.5 1.5h13L27 12l-6.5 10.5h-13L1 12 7.5 1.5Z" />
      <path d="M10 7.5h8l3 4.5-3 4.5h-8L7 12l3-4.5Z" strokeOpacity="0.55" />
    </svg>
  );
}

export function AppShell({
  identity,
  contextLabel,
  navItems,
  trail,
  backLink,
  children,
}: AppShellProps) {
  const theme = PERSONA_THEME[identity.persona];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <div className={`h-1 ${theme.accent}`} aria-hidden />
      <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link
            href={trail?.home ?? "/portal"}
            className="flex min-w-0 items-center gap-2.5"
          >
            <HexMark />
            <span className="min-w-0 leading-tight">
              <span className="block font-[family-name:var(--font-display)] text-base font-semibold tracking-tight">
                SGI Base
              </span>
              <span
                className="block max-w-[14rem] truncate text-xs text-[var(--color-ink-muted)]"
                title={contextLabel}
              >
                {contextLabel}
              </span>
            </span>
          </Link>

          {backLink || trail ? (
            <div className="order-last flex w-full min-w-0 items-center gap-3 border-t border-[var(--color-line)] pt-2">
              {backLink ? (
                <Link
                  href={backLink.href}
                  className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                >
                  ← {backLink.label}
                </Link>
              ) : null}
              {trail ? <ShellTrail index={trail} /> : null}
            </div>
          ) : null}

          <div className="order-1 flex w-full min-w-0 items-center gap-2 sm:order-none sm:ml-auto sm:w-auto sm:gap-3">
            <span
              className={`whitespace-nowrap rounded-[var(--radius-sm)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-on-solid)] ${theme.accent}`}
            >
              {PERSONA_LABELS[identity.persona]}
            </span>
            <div className="hidden min-w-0 leading-tight md:block">
              <p className="truncate text-sm font-semibold">{identity.name}</p>
              <p className="truncate text-xs text-[var(--color-ink-muted)]">
                {identity.email} · {identity.roleLabel}
              </p>
            </div>
            <span title={identity.capabilities.items.join(" · ")}>
              <StatusChip
                status={identity.capabilities.canEdit ? "ok" : "warning"}
                label={identity.capabilities.canEdit ? "Puede editar" : "Solo lectura"}
              />
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
        {navItems ? (
          <nav
            aria-label="Principal"
            className="border-t border-[var(--color-line)] px-4 sm:px-6"
          >
            <NavLinks items={navItems} />
          </nav>
        ) : null}
      </header>
      <main id="contenido-principal" className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
