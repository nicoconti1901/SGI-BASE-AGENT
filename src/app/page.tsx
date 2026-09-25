import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">SGI Base</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900">
          Sistema de Gestión Integrada
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-600">
          Plataforma multi-tenant para ISO 9001, 14001 y 45001. Provisioná tenants,
          cargá el gap y entregá una URL lista al cliente.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/platform"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Ir a plataforma
        </Link>
      </div>
    </main>
  );
}
