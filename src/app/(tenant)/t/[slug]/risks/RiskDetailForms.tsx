"use client";

import { useState } from "react";
import { describeAssessmentResult } from "@/domain/risks/assessment";
import {
  saveRiskCanvasAction,
  addRiskAssessmentAction,
  setRiskDecisionAction,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import {
  RISK_RESPONSE_HINTS,
  RISK_RESPONSE_LABELS,
  type RiskResponseDecision,
  type RiskStatus,
} from "@/domain/risks/types";
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

export function RiskDetailForms({
  slug,
  risk,
  members,
  canWrite,
  stages,
}: {
  slug: string;
  risk: {
    id: string;
    title: string;
    status: RiskStatus;
    cause: string;
    event: string;
    effect: string;
    existingControlsJson: unknown;
    responseDecision: string | null;
    responseRationale: string | null;
    responseOwnerUserId: string | null;
    nextReviewAt: Date | string | null;
    assessments: Assessment[];
  };
  members: Member[];
  canWrite: boolean;
  stages: Record<StageKey, StageState>;
}) {
  const [editing, setEditing] = useState<Section | null>(null);
  const controls = Array.isArray(risk.existingControlsJson) ? (risk.existingControlsJson as string[]) : [];
  const writable = canWrite && risk.status !== "closed";
  const decisionEditable = risk.status === "evaluated" || risk.status === "response_planned";
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? "";

  const [canvasState, canvasAction, canvasPending] = useSectionAction(
    "describe",
    saveRiskCanvasAction.bind(null, slug, risk.id),
    setEditing,
  );
  const [assessState, assessAction, assessPending] = useSectionAction(
    "assess",
    addRiskAssessmentAction.bind(null, slug, risk.id),
    setEditing,
  );
  const [decisionState, decisionAction, decisionPending] = useSectionAction(
    "decide",
    setRiskDecisionAction.bind(null, slug, risk.id),
    setEditing,
  );

  const section = (key: Section) => ({
    done: stages[key] === "done",
    current: stages[key] === "current",
    editing: editing === key,
    onEdit: () => setEditing(key),
    onCancel: () => setEditing(null),
  });

  return (
    <div className="flex flex-col gap-6">
      <StageSection
        title="Descripción"
        {...section("describe")}
        canWrite={writable}
        missingNote="Completá causa, evento y efecto: así cualquiera entiende el riesgo y se puede evaluar."
        summary={
          <Summary
            items={[
              { label: "Causa", value: risk.cause },
              { label: "Evento", value: risk.event },
              { label: "Efecto", value: risk.effect },
              {
                label: "Controles existentes",
                value: controls.length ? (
                  <ul className="list-disc pl-5 font-normal">
                    {controls.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  "Ninguno cargado"
                ),
              },
            ]}
          />
        }
        form={
          <form action={canvasAction} className="flex flex-col gap-4">
            {canvasState.error ? <FormError>{canvasState.error}</FormError> : null}
            <Field label="Título" required>
              <input name="title" defaultValue={risk.title} required className={INPUT_CLASS} />
            </Field>
            <Field label="Causa: ¿por qué podría pasar?" hint={FIELD_HINTS.cause}>
              <input name="cause" defaultValue={risk.cause} className={INPUT_CLASS} />
            </Field>
            <Field label="Evento: ¿qué podría ocurrir?" hint={FIELD_HINTS.event}>
              <input name="event" defaultValue={risk.event} className={INPUT_CLASS} />
            </Field>
            <Field label="Efecto: ¿qué consecuencia tendría?" hint={FIELD_HINTS.effect}>
              <input name="effect" defaultValue={risk.effect} className={INPUT_CLASS} />
            </Field>
            <Field label="Controles existentes" hint="Lo que ya hacen hoy para prevenirlo. Uno por renglón.">
              <textarea name="existingControls" defaultValue={controls.join("\n")} rows={3} className={INPUT_CLASS} />
            </Field>
            <SubmitButton pending={canvasPending}>Guardar descripción</SubmitButton>
          </form>
        }
      />

      <StageSection
        title="Evaluación del nivel"
        {...section("assess")}
        canWrite={writable}
        missingNote="Sin evaluación no se puede decidir la respuesta."
        summary={<AssessmentSummary assessments={risk.assessments} describe={describeAssessmentResult} />}
        form={
          <form action={assessAction} className="flex flex-col gap-4">
            {assessState.error ? <FormError>{assessState.error}</FormError> : null}
            <AssessmentFields
              question="¿Qué nivel tiene este riesgo hoy, con los controles actuales?"
              rationalePlaceholder="Ej.: En 2025 hubo dos demoras de más de 48 h y no hay un segundo proveedor homologado."
              hasPrevious={risk.assessments.length > 0}
            />
            <SubmitButton pending={assessPending}>Guardar evaluación</SubmitButton>
          </form>
        }
      />

      <StageSection
        title="Respuesta al riesgo"
        {...section("decide")}
        canWrite={writable && decisionEditable}
        missingNote="Elegí qué se va a hacer con el riesgo y quién lo lleva adelante."
        blockedNote={
          risk.assessments.length === 0 ? "Primero evaluá el riesgo: la respuesta depende de su nivel." : undefined
        }
        summary={
          <>
            <Summary
              items={[
                {
                  label: "Respuesta",
                  value: risk.responseDecision ? (
                    <>
                      {RISK_RESPONSE_LABELS[risk.responseDecision as RiskResponseDecision] ?? risk.responseDecision}
                      <span className="block text-xs font-normal text-[var(--color-ink-muted)]">
                        {RISK_RESPONSE_HINTS[risk.responseDecision as RiskResponseDecision]}
                      </span>
                    </>
                  ) : null,
                },
                { label: "Responsable", value: nameOf(risk.responseOwnerUserId) },
                { label: "Por qué", value: risk.responseRationale },
                {
                  label: "Próxima revisión",
                  value: risk.nextReviewAt ? new Date(risk.nextReviewAt).toLocaleDateString("es-AR") : "Sin fecha",
                },
              ]}
            />
            {writable && !decisionEditable ? (
              <p className="text-xs text-[var(--color-ink-muted)]">
                La respuesta se cambia después de volver a evaluar el riesgo (desde «Estado y próximo paso»).
              </p>
            ) : null}
          </>
        }
        form={
          <form action={decisionAction} className="flex flex-col gap-4">
            {decisionState.error ? <FormError>{decisionState.error}</FormError> : null}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">¿Qué se va a hacer con este riesgo?</legend>
              <ChoiceCards<RiskResponseDecision>
                name="decision"
                defaultValue={risk.responseDecision as RiskResponseDecision | null}
                options={(Object.keys(RISK_RESPONSE_LABELS) as RiskResponseDecision[]).map((k) => ({
                  value: k,
                  label: RISK_RESPONSE_LABELS[k],
                  hint: RISK_RESPONSE_HINTS[k],
                }))}
              />
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <MemberSelect
                name="ownerUserId"
                label="Responsable de la respuesta"
                hint="Lleva adelante la respuesta y avanza el riesgo hasta su cierre."
                members={members}
                defaultValue={risk.responseOwnerUserId}
              />
              <Field label="Próxima revisión" hint="Cuándo se vuelve a mirar el riesgo aunque no pase nada. Ej.: en 6 meses.">
                <input
                  type="date"
                  name="nextReviewAt"
                  defaultValue={risk.nextReviewAt ? new Date(risk.nextReviewAt).toISOString().slice(0, 10) : ""}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <Field label="¿Por qué esta respuesta?" required>
              <textarea
                name="rationale"
                required
                defaultValue={risk.responseRationale ?? ""}
                rows={2}
                placeholder="Ej.: El nivel es alto y homologar un segundo proveedor cuesta menos que un día de línea parada."
                className={INPUT_CLASS}
              />
            </Field>
            <SubmitButton pending={decisionPending}>Guardar respuesta</SubmitButton>
          </form>
        }
      />
    </div>
  );
}
