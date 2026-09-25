import Link from "next/link";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-10 overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_var(--color-accent-soft),_transparent_65%)]"
      />
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-subtle)]">
          SGI Base
        </p>
        <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight text-[var(--color-ink)]">
          Sistema de Gestión Integrada, listo para cada empresa.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-ink-muted)]">
          ISO 9001, 14001 y 45001 en una plataforma multi-tenant: gap cargado,
          documentos respetados o reemplazados, y automatización de vencimientos.
        </p>
      </div>
      <div className="relative flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-accent-hover)]"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/platform"
          className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-[var(--color-accent)]"
        >
          Ir a plataforma
        </Link>
        <Link
          href="/portal"
          className="rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Ver shell del portal
        </Link>
      </div>
    </main>
  );
}
