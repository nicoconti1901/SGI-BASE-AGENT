import Link from "next/link";
import { redirect } from "next/navigation";
import { PLATFORM_ROLE_LABEL } from "@/domain/identity/authz";
import { getSession } from "@/lib/session";

export default async function PlatformHomePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const platformRole = (session.user as { platformRole?: string | null }).platformRole;
  const isSuperuser = platformRole === "platform_superuser";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--color-ink)]">
          Panel de plataforma
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Sesión iniciada como <strong>{session.user.email}</strong>
          {isSuperuser ? ` (${PLATFORM_ROLE_LABEL})` : ""}.
        </p>
      </div>

      {!isSuperuser ? (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)]">
          Esta cuenta no tiene rol de {PLATFORM_ROLE_LABEL.toLowerCase()}. El
          portal de tenant se construye en tareas posteriores.
        </p>
      ) : (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/25 bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-success)]">
          Autenticación OK. El provisionamiento de tenants llega en la Task 5.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ShellCard
          title="Automatizaciones"
          body="Ofertas, scan de vencimientos y auditoría de runs."
          href="/platform/automations"
        />
        <ShellCard
          title="Tenants"
          body="Alta de empresas y plantillas esenciales."
          href="/platform/tenants"
        />
        <ShellCard
          title="Catálogo ISO"
          body="Requisitos 9001 / 14001 / 45001."
          href="/platform/catalog"
        />
      </div>

      <Link
        href="/"
        className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
      >
        Volver al inicio
      </Link>
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
