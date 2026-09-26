"use client";

import { useActionState } from "react";
import {
  saveOpportunityCanvasAction,
  addOpportunityAssessmentAction,
  setOpportunityDecisionAction,
  transitionOpportunityAction,
  type RoActionState,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import {
  OPPORTUNITY_PURSUIT_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  type OpportunityPursuitDecision,
  type OpportunityStatus,
} from "@/domain/opportunities/types";
import { nextStatusesForOpportunity } from "@/domain/opportunities/lifecycle";
import {
  QUALITATIVE_LEVEL_LABELS,
  QUALITATIVE_LEVELS,
} from "@/domain/risks/types";

type Member = { id: string; name: string };
type Assessment = {
  id: string;
  version: number;
  method: string;
  rationale: string;
  resultJson: unknown;
  assessedAt: Date | string;
};

const initial: RoActionState = {};

export function OpportunityDetailForms({
  slug,
  opportunity,
  members,
  canWrite,
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
}) {
  const canvasBound = saveOpportunityCanvasAction.bind(
    null,
    slug,
    opportunity.id,
  );
  const assessBound = addOpportunityAssessmentAction.bind(
    null,
    slug,
    opportunity.id,
  );
  const decisionBound = setOpportunityDecisionAction.bind(
    null,
    slug,
    opportunity.id,
  );
  const [canvasState, canvasAction, canvasPending] = useActionState(
    canvasBound,
    initial,
  );
  const [assessState, assessAction, assessPending] = useActionState(
    assessBound,
    initial,
  );
  const [decisionState, decisionAction, decisionPending] = useActionState(
    decisionBound,
    initial,
  );

  const next = nextStatusesForOpportunity(opportunity.status);

  return (
    <div className="flex flex-col gap-8">
      <form action={canvasAction} className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Hipótesis: condición → circunstancia → beneficio
        </h2>
        {canvasState.error ? (
          <p className="text-sm text-[var(--color-danger)]">{canvasState.error}</p>
        ) : null}
        {canvasState.ok ? (
          <p className="text-sm text-[var(--color-success)]">{canvasState.ok}</p>
        ) : null}
        <input
          name="title"
          defaultValue={opportunity.title}
          required
          disabled={!canWrite}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          name="condition"
          defaultValue={opportunity.condition}
          placeholder="Condición"
          disabled={!canWrite}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          name="circumstance"
          defaultValue={opportunity.circumstance}
          placeholder="Circunstancia"
          disabled={!canWrite}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          name="benefit"
          defaultValue={opportunity.benefit}
          placeholder="Beneficio"
          disabled={!canWrite}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        {canWrite ? (
          <button
            type="submit"
            disabled={canvasPending}
            className="self-start rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white"
          >
            Guardar hipótesis
          </button>
        ) : null}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Evaluaciones (versionadas)
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {opportunity.assessments.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-[var(--color-border)] px-3 py-2"
            >
              <strong>v{a.version}</strong> · {a.method} ·{" "}
              {new Date(a.assessedAt).toLocaleString("es-AR")}
              <div className="text-[var(--color-ink-muted)]">
                {JSON.stringify(a.resultJson)} — {a.rationale}
              </div>
            </li>
          ))}
          {opportunity.assessments.length === 0 ? (
            <li className="text-[var(--color-ink-muted)]">Sin evaluaciones aún.</li>
          ) : null}
        </ul>
        {canWrite ? (
          <form action={assessAction} className="flex flex-col gap-2 rounded-md border border-dashed border-[var(--color-border)] p-3">
            {assessState.error ? (
              <p className="text-sm text-[var(--color-danger)]">
                {assessState.error}
              </p>
            ) : null}
            {assessState.ok ? (
              <p className="text-sm text-[var(--color-success)]">
                {assessState.ok}
              </p>
            ) : null}
            <select
              name="level"
              defaultValue="medium"
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              {QUALITATIVE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {QUALITATIVE_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
            <textarea
              name="rationale"
              required
              rows={2}
              placeholder="Racional (valor / factibilidad)"
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={assessPending}
              className="self-start rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white"
            >
              Nueva evaluación
            </button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Decisión de persecución
        </h2>
        {opportunity.pursuitDecision ? (
          <p className="text-sm">
            Actual:{" "}
            <strong>
              {OPPORTUNITY_PURSUIT_LABELS[
                opportunity.pursuitDecision as OpportunityPursuitDecision
              ] ?? opportunity.pursuitDecision}
            </strong>
            {opportunity.pursuitRationale
              ? ` — ${opportunity.pursuitRationale}`
              : null}
          </p>
        ) : null}
        {canWrite ? (
          <form action={decisionAction} className="flex flex-col gap-2">
            {decisionState.error ? (
              <p className="text-sm text-[var(--color-danger)]">
                {decisionState.error}
              </p>
            ) : null}
            {decisionState.ok ? (
              <p className="text-sm text-[var(--color-success)]">
                {decisionState.ok}
              </p>
            ) : null}
            <select
              name="decision"
              required
              defaultValue={opportunity.pursuitDecision ?? "pursue_now"}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              {Object.entries(OPPORTUNITY_PURSUIT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              name="ownerUserId"
              defaultValue={opportunity.pursuitOwnerUserId ?? ""}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              <option value="">Responsable (opcional)…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <textarea
              name="rationale"
              required
              defaultValue={opportunity.pursuitRationale ?? ""}
              rows={2}
              placeholder="Racional"
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />
            <label className="text-sm">
              Próxima revisión
              <input
                type="date"
                name="nextReviewAt"
                defaultValue={
                  opportunity.nextReviewAt
                    ? new Date(opportunity.nextReviewAt)
                        .toISOString()
                        .slice(0, 10)
                    : ""
                }
                className="mt-1 block rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={decisionPending}
              className="self-start rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white"
            >
              Guardar decisión
            </button>
          </form>
        ) : null}
      </section>

      {canWrite && next.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          <span className="w-full text-sm text-[var(--color-ink-muted)]">
            Estado: {OPPORTUNITY_STATUS_LABELS[opportunity.status]} →
          </span>
          {next.map((to) => (
            <button
              key={to}
              type="button"
              className="rounded-md border border-[var(--color-border)] px-3 py-1 text-sm"
              onClick={async () => {
                await transitionOpportunityAction(slug, opportunity.id, to);
              }}
            >
              {OPPORTUNITY_STATUS_LABELS[to]}
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
