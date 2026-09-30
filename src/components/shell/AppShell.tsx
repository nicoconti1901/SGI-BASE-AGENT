import Link from "next/link";
import { NavLinks } from "@/components/shell/NavLinks";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { PERSONA_THEME, type NavItem } from "@/components/shell/nav-config";
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
  navItems: readonly NavItem[];
  /** Salida a un nivel superior (ej. superusuario dentro de una empresa). */
  backLink?: NavItem;
  children: React.ReactNode;
};

export function AppShell({
  identity,
  contextLabel,
  navItems,
  backLink,
  children,
}: AppShellProps) {
  const theme = PERSONA_THEME[identity.persona];

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <aside
        className={`flex w-64 shrink-0 flex-col border-r border-black/10 ${theme.rail}`}
        aria-label="Navegación"
      >
        <div className={`h-1.5 ${theme.accent}`} aria-hidden />
        <div className="border-b border-white/10 px-5 py-6">
          <Link href="/portal" className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
            SGI Base
          </Link>
          <p className="mt-1 truncate text-sm font-semibold opacity-90" title={contextLabel}>
            {contextLabel}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Principal">
          {backLink ? (
            <Link
              href={backLink.href}
              className="mb-2 rounded-[var(--radius-md)] border border-white/20 px-3 py-2 text-sm font-medium opacity-90 hover:bg-white/10"
            >
              ← {backLink.label}
            </Link>
          ) : null}
          <NavLinks items={navItems} />
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-xs opacity-60">
          ISO 9001 · 14001 · 45001
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`h-1.5 ${theme.accent}`} aria-hidden />
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span
              className={`rounded-[var(--radius-sm)] px-3 py-1 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-on-solid)] ${theme.accent}`}
            >
              {PERSONA_LABELS[identity.persona]}
            </span>
            <div className="min-w-0 leading-tight">
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main id="contenido-principal" className="flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
