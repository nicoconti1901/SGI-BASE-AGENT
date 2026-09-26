"use client";

import { useActionState } from "react";
import {
  WORKFLOW_STATUSES,
  WORKFLOW_STATUS_LABELS,
  type WorkflowStatus,
} from "@/domain/operations/nc";
import {
  createActionAction,
  createNcAction,
  updateActionStatusAction,
  updateNcStatusAction,
  type OpsActionState,
} from "@/app/(tenant)/t/[slug]/operations/actions";

const initial: OpsActionState = {};

export function CreateNcForm({ slug }: { slug: string }) {
  const action = createNcAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl">
        Nueva no conformidad
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
        Descripción
        <textarea
          name="description"
          rows={3}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Responsable
          <input
            name="ownerName"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Origen
          <input
            name="source"
            placeholder="Auditoría, cliente, proceso…"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>
      </div>
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
        {pending ? "Creando…" : "Crear NC"}
      </button>
    </form>
  );
}

export function UpdateNcStatusForm({
  slug,
  ncId,
  current,
}: {
  slug: string;
  ncId: string;
  current: WorkflowStatus;
}) {
  const action = updateNcStatusAction.bind(null, slug, ncId);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Estado
        <select
          name="status"
          defaultValue={current}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        >
          {WORKFLOW_STATUSES.map((status) => (
            <option key={status} value={status}>
              {WORKFLOW_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "…" : "Actualizar"}
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

export function CreateActionForm({
  slug,
  ncId,
}: {
  slug: string;
  ncId: string;
}) {
  const action = createActionAction.bind(null, slug, ncId);
  const [state, formAction, pending] = useActionState(action, initial);
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 14);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl">
        Nueva acción correctiva
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
        Descripción
        <textarea
          name="description"
          rows={2}
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Responsable
          <input
            name="ownerName"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
          Vence el
          <input
            name="dueAt"
            type="date"
            defaultValue={defaultDue.toISOString().slice(0, 10)}
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
          />
        </label>
      </div>
      <p className="text-xs text-[var(--color-ink-subtle)]">
        Si hay fecha de vencimiento, se crea un ítem en el motor de due dates.
      </p>
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
        {pending ? "Creando…" : "Agregar acción"}
      </button>
    </form>
  );
}

export function UpdateActionStatusForm({
  slug,
  ncId,
  actionId,
  current,
}: {
  slug: string;
  ncId: string;
  actionId: string;
  current: WorkflowStatus;
}) {
  const action = updateActionStatusAction.bind(null, slug, ncId, actionId);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <select
        name="status"
        defaultValue={current}
        className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-ink)]"
      >
        {WORKFLOW_STATUSES.map((status) => (
          <option key={status} value={status}>
            {WORKFLOW_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-2 py-1.5 text-xs font-medium disabled:opacity-60"
      >
        {pending ? "…" : "OK"}
      </button>
      {state.error ? (
        <span className="text-xs text-[var(--color-danger)]">{state.error}</span>
      ) : null}
    </form>
  );
}
