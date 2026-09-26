"use client";

import { useActionState } from "react";
import {
  exploreContextAction,
  type RoActionState,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import { SOURCE_KIND_LABELS, SOURCE_KINDS } from "@/domain/risks/types";

type FindingOpt = { id: string; title: string; type: string };

const initial: RoActionState = {};

export function ExploreContextForm({
  slug,
  findings,
}: {
  slug: string;
  findings: FindingOpt[];
}) {
  const action = exploreContextAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="font-medium">Fuente / contexto</legend>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de fuente
          <select
            name="sourceKind"
            defaultValue="supplier"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          >
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {SOURCE_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Descripción de la fuente
          <input
            name="sourceLabel"
            required
            placeholder="Ej.: Proveedor único de acero"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hallazgo vinculado (opcional)
          <select
            name="findingId"
            defaultValue=""
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          >
            <option value="">— Sin vínculo —</option>
            {findings.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">¿Qué nace de esta exploración?</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="createRisk" defaultChecked />
          Riesgo (efecto no deseado)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="createOpportunity" />
          Oportunidad (potencial de beneficio)
        </label>
      </fieldset>

      <details className="rounded-md border border-[var(--color-border)] p-4 open:bg-[var(--color-surface)]">
        <summary className="cursor-pointer font-medium">
          Canvas de riesgo (opcional ahora)
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <input
            name="riskTitle"
            placeholder="Título del riesgo"
            className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="cause"
            placeholder="Causa"
            className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="event"
            placeholder="Evento"
            className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="effect"
            placeholder="Efecto"
            className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <textarea
            name="existingControls"
            rows={2}
            placeholder="Controles existentes (uno por línea)"
            className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </details>

      <details className="rounded-md border border-[var(--color-border)] p-4">
        <summary className="cursor-pointer font-medium">
          Hipótesis de oportunidad (opcional ahora)
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <input
            name="opportunityTitle"
            placeholder="Título de la oportunidad"
            className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="condition"
            placeholder="Condición"
            className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="circumstance"
            placeholder="Circunstancia favorable"
            className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="benefit"
            placeholder="Beneficio esperado"
            className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </details>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg,white)] disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Registrar exploración"}
      </button>
    </form>
  );
}
