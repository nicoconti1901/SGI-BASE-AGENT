import Link from "next/link";

export default function PlatformHomePage() {
  // El layout garantiza que solo entra el superusuario.
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--color-ink)]">
          Panel de plataforma
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Alta de empresas, catálogo ISO y automatizaciones de todas las empresas.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ShellCard
          title="Automatizaciones"
          body="Ofertas, scan de vencimientos y auditoría de runs."
          href="/platform/automations"
        />
        <ShellCard
          title="Empresas"
          body="Alta de empresas y acceso a su portal."
          href="/platform/tenants"
        />
        <ShellCard
          title="Catálogo ISO"
          body="Requisitos 9001 / 14001 / 45001."
          href="/platform/catalog"
        />
      </div>
    </div>
  );
}

function ShellCard({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)] transition duration-[var(--duration-med)] ease-[var(--ease-out)] hover:-translate-y-0.5"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--color-ink)]">
        {title}
      </h2>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{body}</p>
    </Link>
  );
}
