"use client";

import { useActionState } from "react";
import {
  createOpportunityDirectAction,
  createRiskDirectAction,
  type RoActionState,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import {
  OpportunityFields,
  RiskStatementFields,
  SourceFields,
  type FindingOpt,
} from "@/app/(tenant)/t/[slug]/risks/FormFields";

const initial: RoActionState = {};

/** Alta de un riesgo u oportunidad que ya se conoce, sin pasar por la exploración. */
export function DirectEntryForm({
  slug,
  kind,
  findings,
}: {
  slug: string;
  kind: "risk" | "opportunity";
  findings: FindingOpt[];
}) {
  const action = (kind === "risk" ? createRiskDirectAction : createOpportunityDirectAction).bind(
    null,
    slug,
  );
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p role="alert" className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}

      {kind === "risk" ? <RiskStatementFields titleRequired /> : <OpportunityFields titleRequired />}

      <fieldset className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
        <legend className="mb-2 font-medium">Origen (opcional)</legend>
        <SourceFields findings={findings} sourceRequired={false} />
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : kind === "risk" ? "Registrar riesgo" : "Registrar oportunidad"}
      </button>
    </form>
  );
}
