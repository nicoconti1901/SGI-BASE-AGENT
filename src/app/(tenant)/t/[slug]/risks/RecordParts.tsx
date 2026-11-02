"use client";

import { useState } from "react";
import {
  transitionOpportunityAction,
  transitionRiskAction,
  type RoActionState,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import type { OpportunityStatus } from "@/domain/opportunities/types";
import type { RiskStatus } from "@/domain/risks/types";
import { Field, INPUT_CLASS } from "@/components/ui";

/** Botón del próximo cambio de estado y, aparte, el cierre con motivo. */
export function StatusControls({
  slug,
  kind,
  id,
  advance,
  canClose,
}: {
  slug: string;
  kind: "risk" | "opportunity";
  id: string;
  advance: { to: string; label: string } | null;
  canClose: boolean;
}) {
  const [state, setState] = useState<RoActionState>({});
  const [pending, setPending] = useState(false);
  const [closing, setClosing] = useState(false);

  async function go(to: string, formData?: FormData) {
    setPending(true);
    setState(
      kind === "risk"
        ? await transitionRiskAction(slug, id, to as RiskStatus, formData)
        : await transitionOpportunityAction(slug, id, to as OpportunityStatus, formData),
    );
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {advance ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => go(advance.to)}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-solid)] disabled:opacity-60"
          >
            {advance.label}
          </button>
        ) : null}
        {canClose && !closing ? (
          <button
            type="button"
            onClick={() => setClosing(true)}
            className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-2 text-sm font-medium hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
          >
            {kind === "risk" ? "Cerrar riesgo" : "Cerrar oportunidad"}
          </button>
        ) : null}
      </div>
      {closing ? (
        <form
          action={(fd) => go("closed", fd)}
          className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] p-3"
        >
          <Field label="¿Por qué se cierra?" hint="Ej.: el proceso que lo generaba dejó de existir.">
            <textarea name="closeRationale" rows={2} required className={INPUT_CLASS} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-sm font-semibold text-[var(--color-danger)]"
            >
              Confirmar cierre
            </button>
            <button type="button" onClick={() => setClosing(false)} className="text-sm underline">
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
