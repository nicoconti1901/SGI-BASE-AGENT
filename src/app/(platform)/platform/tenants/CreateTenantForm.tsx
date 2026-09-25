"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createTenantAction,
  type CreateTenantState,
} from "@/app/(platform)/platform/tenants/actions";
import { slugifyTenantName } from "@/domain/tenant/provisioning";

const initialState: CreateTenantState = {};

export function CreateTenantForm() {
  const [state, formAction, pending] = useActionState(
    createTenantAction,
    initialState,
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const suggestedSlug = useMemo(() => slugifyTenantName(name), [name]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5 shadow-[var(--shadow-soft)]"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl">
        Nueva empresa (tenant)
      </h2>
      <p className="text-sm text-[var(--color-ink-muted)]">
        Se aplicará una plantilla de requisitos según tamaño y actividad. Las
        empresas <strong>small</strong> reciben solo el baseline esencial
        (primerizas).
      </p>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Nombre
        <input
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugifyTenantName(e.target.value));
          }}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          placeholder="Acme Sur S.A."
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Slug (URL `/t/slug`)
        <input
          name="slug"
          value={slug || suggestedSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm text-[var(--color-ink)]"
          placeholder="acme-sur"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Tamaño
          <select
            name="size"
            required
            defaultValue="small"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          >
            <option value="small">Small — solo esenciales</option>
            <option value="medium">Medium — esenciales + actividad</option>
            <option value="large">Large — plantilla ampliada</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Actividad
          <select
            name="activity"
            required
            defaultValue="servicios"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          >
            <option value="manufactura">Manufactura</option>
            <option value="servicios">Servicios</option>
            <option value="construccion">Construcción</option>
            <option value="comercio">Comercio</option>
            <option value="otro">Otro</option>
          </select>
        </label>
      </div>

      {state.error ? (
        <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear tenant y aplicar plantilla"}
      </button>
    </form>
  );
}
