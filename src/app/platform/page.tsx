import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function PlatformHomePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const platformRole = (session.user as { platformRole?: string | null }).platformRole;
  const isSuperuser = platformRole === "platform_superuser";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Plataforma</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          Panel de superusuario
        </h1>
        <p className="mt-2 text-zinc-600">
          Sesión iniciada como <strong>{session.user.email}</strong>
          {isSuperuser ? " (platform_superuser)" : ""}.
        </p>
      </div>

      {!isSuperuser ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta cuenta no tiene rol de superusuario de plataforma. El portal de tenant se
          construye en tareas posteriores.
        </p>
      ) : (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Autenticación OK. El provisionamiento de tenants llega en la Task 5.
        </p>
      )}

      <Link href="/" className="text-sm font-medium text-zinc-900 underline">
        Volver al inicio
      </Link>
    </main>
  );
}
