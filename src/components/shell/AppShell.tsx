import Link from "next/link";
import type { ShellKind } from "@/components/shell/nav-config";
import { shellTitle } from "@/components/shell/nav-config";

type AppShellProps = {
  kind: ShellKind;
  navItems: readonly { href: string; label: string }[];
  eyebrow?: string;
  children: React.ReactNode;
};

export function AppShell({ kind, navItems, eyebrow, children }: AppShellProps) {
  const isPlatform = kind === "platform";
  const railClass = isPlatform
    ? "bg-[var(--color-platform-rail)] text-[var(--color-platform-rail-ink)]"
    : "bg-[var(--color-tenant-rail)] text-[var(--color-tenant-rail-ink)]";

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <aside
        className={`flex w-64 shrink-0 flex-col border-r border-black/10 ${railClass}`}
        aria-label={isPlatform ? "Navegación de plataforma" : "Navegación del portal"}
      >
        <div className="border-b border-white/10 px-5 py-6">
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
            SGI Base
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] opacity-70">
            {shellTitle(kind)}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Principal">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium opacity-90 transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-white/10 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-xs opacity-60">
          ISO 9001 · 14001 · 45001
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-4">
          <div>
            {eyebrow ? (
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">
                {eyebrow}
              </p>
            ) : null}
            <p className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">
              {shellTitle(kind)}
            </p>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Cuenta
          </Link>
        </header>
        <main id="contenido-principal" className="flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
