"use client";

import { useState } from "react";
import { describeAssessmentResult } from "@/domain/risks/assessment";
import {
  saveOpportunityCanvasAction,
  addOpportunityAssessmentAction,
  setOpportunityDecisionAction,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import {
  OPPORTUNITY_PURSUIT_HINTS,
  OPPORTUNITY_PURSUIT_LABELS,
  type OpportunityPursuitDecision,
  type OpportunityStatus,
} from "@/domain/opportunities/types";
import type { StageKey, StageState } from "@/domain/risks/progress";
import { FIELD_HINTS } from "@/domain/risks/guide";
import { ChoiceCards, Field, FormError, INPUT_CLASS, StageSection, Summary } from "@/components/ui";
import {
  AssessmentFields,
  AssessmentSummary,
  MemberSelect,
  SubmitButton,
  useSectionAction,
  type Assessment,
  type Member,
} from "@/app/(tenant)/t/[slug]/risks/RecordFields";

type Section = "describe" | "assess" | "decide";

/** «Cerrar» se hace desde el estado, con su motivo; no es una decisión de la ficha. */
const DECISIONS: OpportunityPursuitDecision[] = ["pursue_now", "pursue_later", "investigate", "monitor", "do_not_pursue"];

export function OpportunityDetailForms({
  slug,
  opportunity,
  members,
  canWrite,
  stages,
}: {
  slug: string;
  opportunity: {
    id: string;
    title: string;
    status: OpportunityStatus;
    condition: string;
    circumstance: string;
    benefit: string;
    pursuitDecision: string | null;
    pursuitRationale: string | null;
    pursuitOwnerUserId: string | null;
    nextReviewAt: Date | string | null;
    assessments: Assessment[];
  };
  members: Member[];
  canWrite: boolean;
  stages: Record<StageKey, StageState>;
}) {
  const [editing, setEditing] = useState<Section | null>(null);
  const writable = canWrite && opportunity.status !== "closed";
  const decisionEditable = opportunity.status === "evaluated" || opportunity.status === "decision";
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? "";

  const [canvasState, canvasAction, canvasPending] = useSectionAction(
    "describe",
    saveOpportunityCanvasAction.bind(null, slug, opportunity.id),
    setEditing,
  );
  const [assessState, assessAction, assessPending] = useSectionAction(
    "assess",
    addOpportunityAssessmentAction.bind(null, slug, opportunity.id),
    setEditing,
  );
  const [decisionState, decisionAction, decisionPending] = useSectionAction(
    "decide",
    setOpportunityDecisionAction.bind(null, slug, opportunity.id),
    setEditing,
  );

  const section = (key: Section) => ({
    done: stages[key] === "done",
    current: stages[key] === "current",
    editing: editing === key,
    onEdit: () => setEditing(key),
    onCancel: () => setEditing(null),
  });
  const decision = opportunity.pursuitDecision as OpportunityPursuitDecision | null;

  return (
    <div className="flex flex-col gap-6">
      <StageSection
        title="Descripción"
        {...section("describe")}
        canWrite={writable}
        missingNote="Completá la situación actual, la circunstancia favorable y el beneficio esperado."
        summary={
          <Summary
            items={[
              { label: "Situación actual", value: opportunity.condition },
              { label: "Circunstancia favorable", value: opportunity.circumstance },
              { label: "Beneficio esperado", value: opportunity.benefit },
            ]}
          />
        }
        form={
          <form action={canvasAction} className="flex flex-col gap-4">
            {canvasState.error ? <FormError>{canvasState.error}</FormError> : null}
            <Field label="Título" required>
              <input name="title" defaultValue={opportunity.title} required className={INPUT_CLASS} />
            </Field>
            <Field label="Situación actual" hint={FIELD_HINTS.condition}>
              <input name="condition" defaultValue={opportunity.condition} className={INPUT_CLASS} />
            </Field>
            <Field label="Circunstancia favorable" hint={FIELD_HINTS.circumstance}>
              <input name="circumstance" defaultValue={opportunity.circumstance} className={INPUT_CLASS} />
            </Field>
            <Field label="Beneficio esperado" hint={FIELD_HINTS.benefit}>
              <input name="benefit" defaultValue={opportunity.benefit} className={INPUT_CLASS} />
            </Field>
            <SubmitButton pending={canvasPending}>Guardar descripción</SubmitButton>
          </form>
        }
      />

      <StageSection
        title="Evaluación del valor"
        {...section("assess")}
        canWrite={writable}
        missingNote="Sin evaluación no se puede decidir si se persigue."
        summary={<AssessmentSummary assessments={opportunity.assessments} describe={describeAssessmentResult} />}
        form={
          <form action={assessAction} className="flex flex-col gap-4">
            {assessState.error ? <FormError>{assessState.error}</FormError> : null}
            <AssessmentFields
              question="¿Cuánto valor tendría aprovecharla?"
              rationalePlaceholder="Ej.: Ahorraría unas 20 horas al mes de carga manual y bajaría los errores de pedidos."
              hasPrevious={opportunity.assessments.length > 0}
            />
            <SubmitButton pending={assessPending}>Guardar evaluación</SubmitButton>
          </form>
        }
      />

      <StageSection
        title="Decisión"
        {...section("decide")}
        canWrite={writable && decisionEditable}
        missingNote="Decidí si se persigue y quién la lleva adelante."
        blockedNote={
          opportunity.assessments.length === 0
            ? "Primero evaluá la oportunidad: la decisión depende de su valor."
            : undefined
        }
        summary={
          <Summary
            items={[
              {
                label: "Decisión",
                value: decision ? (
                  <>
                    {OPPORTUNITY_PURSUIT_LABELS[decision] ?? decision}
                    <span className="block text-xs font-normal text-[var(--color-ink-muted)]">
                      {OPPORTUNITY_PURSUIT_HINTS[decision]}
                    </span>
                  </>
                ) : null,
              },
              { label: "Responsable", value: nameOf(opportunity.pursuitOwnerUserId) || "Sin asignar" },
              { label: "Por qué", value: opportunity.pursuitRationale },
              {
                label: "Próxima revisión",
                value: opportunity.nextReviewAt ? new Date(opportunity.nextReviewAt).toLocaleDateString("es-AR") : "Sin fecha",
              },
            ]}
          />
        }
        form={
          <form action={decisionAction} className="flex flex-col gap-4">
            {decisionState.error ? <FormError>{decisionState.error}</FormError> : null}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">¿Qué se hace con esta oportunidad?</legend>
              <ChoiceCards<OpportunityPursuitDecision>
                name="decision"
                defaultValue={decision}
                options={DECISIONS.map((k) => ({
                  value: k,
                  label: OPPORTUNITY_PURSUIT_LABELS[k],
                  hint: OPPORTUNITY_PURSUIT_HINTS[k],
                }))}
              />
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <MemberSelect
                name="ownerUserId"
                label="Responsable de llevarla adelante"
                hint="Avanza la oportunidad y sus acciones."
                members={members}
                defaultValue={opportunity.pursuitOwnerUserId}
              />
              <Field label="Próxima revisión" hint="Cuándo se vuelve a mirar la decisión. Ej.: en 3 meses.">
                <input
                  type="date"
                  name="nextReviewAt"
                  defaultValue={opportunity.nextReviewAt ? new Date(opportunity.nextReviewAt).toISOString().slice(0, 10) : ""}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <Field label="¿Por qué esta decisión?" required>
              <textarea
                name="rationale"
                required
                defaultValue={opportunity.pursuitRationale ?? ""}
                rows={2}
                placeholder="Ej.: El ERP ya está contratado; el costo es solo de configuración."
                className={INPUT_CLASS}
              />
            </Field>
            <SubmitButton pending={decisionPending}>Guardar decisión</SubmitButton>
          </form>
        }
      />
    </div>
  );
}
