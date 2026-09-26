"use client";

import { useActionState } from "react";
import {
  startFindingAction,
  type FindingActionState,
} from "@/app/(tenant)/t/[slug]/findings/actions";
import {
  FINDING_TYPE_LABELS,
  type FindingType,
} from "@/domain/findings/types";

const initial: FindingActionState = {};

export function StartFindingForm({ slug }: { slug: string }) {
  const action = startFindingAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl">
        Nuevo hallazgo
      </h2>
      <p className="text-sm text-[var(--color-ink-muted)]">
        Siempre se parte de un hallazgo. El tipo define el formulario completo
        (causa, medidas, notificados).
      </p>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Tipo
        <select
          name="type"
          defaultValue="nonconformity"
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        >
          {(Object.keys(FINDING_TYPE_LABELS) as FindingType[]).map((t) => (
            <option key={t} value={t}>
              {FINDING_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Título preliminar
        <input
          name="title"
          required
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
        Descripción preliminar
        <textarea
          name="description"
          rows={2}
          required
          className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Creando…" : "Continuar al laboratorio"}
      </button>
    </form>
  );
}
