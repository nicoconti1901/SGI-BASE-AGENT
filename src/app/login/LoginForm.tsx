"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError("Email o contraseña incorrectos.");
        return;
      }

      // /portal decide el destino: plataforma o la empresa del usuario.
      router.push("/portal");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error de red al iniciar sesión";
      setError(
        `${message}. Revisá que la app y la API usen el mismo origen (mismo puerto).`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-6 shadow-[var(--shadow-soft)]"
    >
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          autoFocus={!defaultEmail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Contraseña
        <input
          type="password"
          required
          autoComplete="current-password"
          autoFocus={Boolean(defaultEmail)}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-solid)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
      >
        {loading ? "Ingresando…" : "Entrar"}
      </button>
    </form>
  );
}
