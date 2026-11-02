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
import type { SourceKind } from "@/domain/risks/types";
import { FormError, GuidedSteps, type GuidedStep } from "@/components/ui";
import { useKeepInputs } from "@/lib/use-keep-inputs";

const initial: RoActionState = {};

/** Alta de un riesgo o de una oportunidad en dos pasos: qué es y de dónde surge. Se evalúa después, en su ficha. */
export function DirectEntryForm({
  slug,
  kind,
  findings,
  initialSource,
}: {
  slug: string;
  kind: "risk" | "opportunity";
  findings: FindingOpt[];
  initialSource?: { kind?: SourceKind; label?: string; findingId?: string };
}) {
  const action = (kind === "risk" ? createRiskDirectAction : createOpportunityDirectAction).bind(
    null,
    slug,
  );
  const [state, formAction, pending] = useActionState(action, initial);
  const form = useKeepInputs(formAction, state);

  const steps: GuidedStep[] = [
    {
      key: "what",
      label: kind === "risk" ? "Qué podría salir mal" : "Qué aprovechar",
      title: kind === "risk" ? "¿Qué podría salir mal?" : "¿Qué se podría aprovechar?",
      hint:
        kind === "risk"
          ? "Con el título alcanza para registrarlo; causa, evento y efecto ayudan a evaluarlo después."
          : "Con el título alcanza para registrarla; el resto ayuda a evaluarla después.",
      content: kind === "risk" ? <RiskStatementFields titleRequired /> : <OpportunityFields titleRequired />,
      summarize: (r) =>
        kind === "risk"
          ? [
              { label: "Título", value: r.get("title") },
              { label: "Causa", value: r.get("cause") },
              { label: "Evento", value: r.get("event") },
              { label: "Efecto", value: r.get("effect") },
            ]
          : [
              { label: "Título", value: r.get("title") },
              { label: "Situación actual", value: r.get("condition") },
              { label: "Beneficio esperado", value: r.get("benefit") },
            ],
    },
    {
      key: "source",
      label: "De dónde surge",
      title: "¿De dónde surge? (opcional)",
      hint: "Un proceso, un proveedor, un cambio, un hallazgo… Sirve para encontrarlo después.",
      content: <SourceFields findings={findings} sourceRequired={false} initial={initialSource} />,
      summarize: (r) => [
        { label: "Fuente", value: r.get("sourceKind") },
        { label: "Cuál", value: r.get("sourceLabel") },
      ],
    },
  ];

  return (
    <form {...form} className="flex flex-col gap-5">
      {state.error ? <FormError>{state.error}</FormError> : null}
      <GuidedSteps
        steps={steps}
        submitLabel={kind === "risk" ? "Registrar riesgo" : "Registrar oportunidad"}
        pending={pending}
      />
      <p className="text-sm text-[var(--color-ink-muted)]">
        Al registrarl{kind === "risk" ? "o" : "a"} se abre su ficha, donde se evalúa y se decide qué hacer.
      </p>
    </form>
  );
}
