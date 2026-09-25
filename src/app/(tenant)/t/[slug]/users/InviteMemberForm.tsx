"use client";

import { useActionState } from "react";
import {
  inviteMemberAction,
  type InviteState,
} from "@/app/(tenant)/t/[slug]/users/actions";
import {
  TENANT_ROLE_DESCRIPTIONS,
  TENANT_ROLE_LABELS,
  TENANT_ROLE_OPTIONS,
} from "@/domain/identity/authz";

const initial: InviteState = {};

export function InviteMemberForm({ slug }: { slug: string }) {
  const action = inviteMemberAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)]"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl">
        Invitar usuario
      </h2>
      <p className="text-sm text-[var(--color-ink-muted)]">
        Crea la cuenta (si no existe) y la membresía en este tenant. El usuario
        inicia sesión en `/login` con el email y la contraseña definida acá.
      </p>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Nombre
        <input
          name="name"
          required
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Email
        <input
          name="email"
          type="email"
          required
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Contraseña temporal
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Rol
        <select
          name="role"
          defaultValue="contributor"
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        >
          {TENANT_ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {TENANT_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      <ul className="space-y-1 text-xs text-[var(--color-ink-subtle)]">
        {TENANT_ROLE_OPTIONS.map((role) => (
          <li key={role}>
            <strong>{TENANT_ROLE_LABELS[role]}:</strong>{" "}
            {TENANT_ROLE_DESCRIPTIONS[role]}
          </li>
        ))}
      </ul>

      {state.error ? (
        <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-[var(--color-success)]">
          Usuario invitado correctamente.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Invitando…" : "Invitar"}
      </button>
    </form>
  );
}
