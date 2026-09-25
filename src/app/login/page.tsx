"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await authClient.signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "No se pudo iniciar sesión");
      return;
    }

    router.push("/platform");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">SGI Base</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-zinc-600">
          Acceso para superusuario de plataforma y usuarios de tenant.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-zinc-400 focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Contraseña
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-zinc-400 focus:ring-2"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? "Ingresando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
