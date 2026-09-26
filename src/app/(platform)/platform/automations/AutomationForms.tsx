"use client";

import { useActionState } from "react";
import {
  createDueItemAction,
  runDueScanAction,
  toggleOfferAction,
  type AutomationActionState,
} from "@/app/(platform)/platform/automations/actions";

const initial: AutomationActionState = {};

export function RunDueScanForm({ defaultSlug = "" }: { defaultSlug?: string }) {
  const [state, formAction, pending] = useActionState(runDueScanAction, initial);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl">
        Ejecutar scan de vencimientos
      </h2>
      <p className="text-sm text-[var(--color-ink-muted)]">
        Job invocable (MVP). Más adelante se puede programar con cron/Inngest.
        Dejá el slug vacío para escanear todos los tenants.
      </p>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Slug de tenant (opcional)
        <input
          name="slug"
          defaultValue={defaultSlug}
          placeholder="ej. acme"
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-[var(--color-success)]">{state.ok}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Ejecutando…" : "Correr scan"}
      </button>
    </form>
  );
}

export function ToggleOfferForm({
  slug,
  offerCode,
  active,
}: {
  slug: string;
  offerCode: string;
  active: boolean;
}) {
  const action = toggleOfferAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="offerCode" value={offerCode} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "…" : active ? "Desactivar" : "Activar"}
      </button>
      {state.error ? (
        <span className="text-xs text-[var(--color-danger)]">{state.error}</span>
      ) : null}
      {state.ok ? (
        <span className="text-xs text-[var(--color-success)]">{state.ok}</span>
      ) : null}
    </form>
  );
}

export function CreateDueItemForm({ slug }: { slug: string }) {
  const action = createDueItemAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 3);
  const defaultDue = tomorrow.toISOString().slice(0, 10);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl">
        Crear vencimiento
      </h2>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Título
        <input
          name="title"
          required
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Tipo de entidad
        <select
          name="entityType"
          defaultValue="document"
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        >
          <option value="document">document</option>
          <option value="action">action</option>
          <option value="indicator">indicator</option>
          <option value="manual">manual</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Vence el
        <input
          name="dueAt"
          type="date"
          required
          defaultValue={defaultDue}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Días de anticipación
        <input
          name="leadDays"
          type="number"
          min={0}
          defaultValue={7}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-[var(--color-success)]">{state.ok}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear"}
      </button>
    </form>
  );
}
