import Link from "next/link";
import { devQuickSignInAction } from "@/app/auth-actions";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { PERSONA_THEME } from "@/components/shell/nav-config";
import { labelTenantRole } from "@/domain/identity/authz";
import {
  describeCapabilities,
  PERSONA_LABELS,
  resolvePersona,
  type Persona,
} from "@/domain/identity/persona";
import {
  isDevQuickAccessEnabled,
  listDevAccounts,
  type DevAccount,
} from "@/lib/dev-access";
import { getAppSessionContext } from "@/lib/session";

export default async function Home() {
  const ctx = await getAppSessionContext();
  const devAccounts = isDevQuickAccessEnabled() ? await listDevAccounts() : null;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 overflow-hidden px-6 py-16">
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
          ISO 9001, 14001 y 45001 en una sola plataforma.
        </p>
      </div>

      {ctx ? (
        <CurrentSession
          persona={resolvePersona(ctx)}
          name={ctx.name}
          email={ctx.email}
        />
      ) : (
        <div className="relative">
          <Link
            href="/login"
            className="inline-block rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-accent-hover)]"
          >
            Iniciar sesión
          </Link>
        </div>
      )}

      {devAccounts ? <DevQuickAccess accounts={devAccounts} /> : null}
    </main>
  );
}

function CurrentSession({
  persona,
  name,
  email,
}: {
  persona: Persona;
  name: string;
  email: string;
}) {
  const theme = PERSONA_THEME[persona];
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white ${theme.accent}`}
        >
          {PERSONA_LABELS[persona]}
        </span>
        <span className="text-sm">
          <strong>{name}</strong>{" "}
          <span className="text-[var(--color-ink-muted)]">{email}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/portal"
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
        >
          Continuar →
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}

function DevQuickAccess({
  accounts,
}: {
  accounts: Awaited<ReturnType<typeof listDevAccounts>>;
}) {
  return (
    <section className="relative flex flex-col gap-4" aria-labelledby="acceso-rapido">
      <div className="flex items-baseline gap-3">
        <h2 id="acceso-rapido" className="font-[family-name:var(--font-display)] text-2xl">
          Acceso rápido
        </h2>
        <span className="rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-warning)]">
          Solo en desarrollo
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DevColumn persona="superuser" subtitle="Plataforma y todas las empresas">
          {accounts.superuser ? (
            <QuickButton account={accounts.superuser} persona="superuser" />
          ) : (
            <Empty>
              Falta crear el superusuario: <code>npm run db:seed</code>
            </Empty>
          )}
        </DevColumn>

        <DevColumn persona="company_admin" subtitle="Ingreso general de la empresa">
          {accounts.companyAdmins.length ? (
            accounts.companyAdmins.map((a) => (
              <QuickButton key={a.email + a.tenantName} account={a} persona="company_admin" />
            ))
          ) : (
            <Empty>Ninguna empresa tiene administrador todavía.</Empty>
          )}
        </DevColumn>

        <DevColumn persona="member" subtitle="Responsables, colaboradores y consulta">
          {accounts.members.map((a) => (
            <QuickButton key={a.email + a.tenantName} account={a} persona="member" />
          ))}
          <Link
            href="/login"
            className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] px-3 py-2 text-center text-sm font-medium text-[var(--color-ink-muted)] hover:border-[var(--color-persona-member)] hover:text-[var(--color-persona-member)]"
          >
            Otro integrante (email y contraseña)
          </Link>
        </DevColumn>
      </div>
    </section>
  );
}

function DevColumn({
  persona,
  subtitle,
  children,
}: {
  persona: Persona;
  subtitle: string;
  children: React.ReactNode;
}) {
  const theme = PERSONA_THEME[persona];
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-soft)]">
      <div className={`h-1.5 ${theme.accent}`} aria-hidden />
      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold">{PERSONA_LABELS[persona]}</h3>
          <p className="text-xs text-[var(--color-ink-muted)]">{subtitle}</p>
        </div>
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function QuickButton({ account, persona }: { account: DevAccount; persona: Persona }) {
  const theme = PERSONA_THEME[persona];
  const caps = account.role
    ? describeCapabilities({ isPlatformSuperuser: false, tenantRole: account.role })
    : null;

  return (
    <form action={devQuickSignInAction.bind(null, account.email)}>
      <button
        type="submit"
        className={`w-full rounded-[var(--radius-md)] px-3 py-2 text-left transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${theme.soft}`}
      >
        <span className="block text-sm font-semibold">{account.name}</span>
        <span className="block text-xs opacity-80">
          {account.tenantName ? `${account.tenantName} · ` : ""}
          {persona === "member" && account.role ? labelTenantRole(account.role) : account.email}
          {caps && persona === "member" ? (caps.canEdit ? " · edita" : " · solo lectura") : ""}
        </span>
      </button>
    </form>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--color-ink-muted)]">{children}</p>;
}
