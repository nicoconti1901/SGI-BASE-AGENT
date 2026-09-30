"use client";

import { useActionState } from "react";
import {
  exploreContextAction,
  type RoActionState,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import type { SourceKind } from "@/domain/risks/types";
import {
  OpportunityFields,
  RiskStatementFields,
  SourceFields,
  type FindingOpt,
} from "@/app/(tenant)/t/[slug]/risks/FormFields";

const initial: RoActionState = {};

export function ExploreContextForm({
  slug,
  findings,
  initialSource,
}: {
  slug: string;
  findings: FindingOpt[];
  initialSource?: { kind?: SourceKind; label?: string; findingId?: string };
}) {
  const action = exploreContextAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p role="alert" className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">1. ¿De dónde partís?</legend>
        <SourceFields findings={findings} initial={initialSource} />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">2. ¿Qué surge de esta fuente?</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="createRisk" defaultChecked />
          Un riesgo: algo que podría salir mal
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="createOpportunity" />
          Una oportunidad: algo que se podría aprovechar
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">3. Describilo (podés completarlo después)</legend>
        <details className="rounded-md border border-[var(--color-line)] p-4 open:bg-[var(--color-surface)]">
          <summary className="cursor-pointer font-medium">Describir el riesgo</summary>
          <div className="mt-3">
            <RiskStatementFields titleName="riskTitle" />
          </div>
        </details>
        <details className="rounded-md border border-[var(--color-line)] p-4 open:bg-[var(--color-surface)]">
          <summary className="cursor-pointer font-medium">Describir la oportunidad</summary>
          <div className="mt-3">
            <OpportunityFields titleName="opportunityTitle" />
          </div>
        </details>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Registrar"}
      </button>
    </form>
  );
}
