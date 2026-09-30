import Link from "next/link";
import { LoginForm } from "@/app/login/LoginForm";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { getAppSessionContext } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; aviso?: string }>;
}) {
  const { email, aviso } = await searchParams;
  const ctx = await getAppSessionContext();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-ink-subtle)]">
          SGI Base
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--color-ink)]">
          Iniciar sesión
        </h1>
      </div>

      {ctx ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm">
          <span>
            Ya estás dentro como <strong>{ctx.email}</strong>
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/portal"
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-2 font-semibold text-[var(--color-on-solid)]"
            >
              Continuar
            </Link>
            <SignOutButton />
          </div>
        </div>
      ) : null}

      {aviso === "clave" ? (
        <p role="status" className="rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)]">
          Esta cuenta tiene otra contraseña. Ingresala para continuar.
        </p>
      ) : null}

      <LoginForm defaultEmail={email ?? ""} />

      <Link href="/" className="text-sm text-[var(--color-accent)] hover:underline">
        Volver al inicio
      </Link>
    </main>
  );
}
