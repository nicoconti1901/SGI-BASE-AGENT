import Link from "next/link";
import { getPlatformOverview } from "@/lib/dashboard";

const SHORTCUTS = [
  {
    title: "Empresas",
    body: "Alta de empresas, relevamiento inicial y acceso a su portal.",
    href: "/platform/tenants",
  },
  {
    title: "Catálogo ISO",
    body: "Requisitos de 9001, 14001 y 45001 que se asignan a cada empresa.",
    href: "/platform/catalog",
  },
  {
    title: "Automatizaciones",
    body: "Ofertas, escaneo de vencimientos y registro de ejecuciones.",
    href: "/platform/automations",
  },
];

export default async function PlatformHomePage() {
  // El layout garantiza que solo entra el superusuario.
  const overview = await getPlatformOverview(new Date());
  const metrics = [
    { label: "Empresas", value: overview.tenants, tone: undefined },
    { label: "Vencimientos abiertos", value: overview.openDue, tone: undefined },
    {
      label: "Vencidos",
      value: overview.overdue,
      tone: overview.overdue > 0 ? "text-[var(--color-danger)]" : undefined,
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header>
        <p className="text-sm text-[var(--color-ink-muted)]">ISO 9001 · 14001 · 45001</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Panel de plataforma
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Alta de empresas, catálogo ISO y automatizaciones de todas las empresas.
        </p>
      </header>

      <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3"
          >
            <p className={`text-2xl font-semibold tabular-nums ${m.tone ?? ""}`}>{m.value}</p>
            <p className="text-xs text-[var(--color-ink-muted)]">{m.label}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-[var(--color-line)] pt-6" aria-label="Accesos">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Accesos
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4 transition duration-[var(--duration-med)] ease-[var(--ease-out)] hover:border-[var(--color-accent)]"
            >
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{s.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
