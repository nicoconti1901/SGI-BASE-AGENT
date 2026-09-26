"use client";

import { useActionState } from "react";
import {
  saveRiskCanvasAction,
  addRiskAssessmentAction,
  setRiskDecisionAction,
  transitionRiskAction,
  type RoActionState,
} from "@/app/(tenant)/t/[slug]/risks/actions";
import {
  QUALITATIVE_LEVEL_LABELS,
  QUALITATIVE_LEVELS,
  RISK_RESPONSE_LABELS,
  RISK_STATUS_LABELS,
  type RiskResponseDecision,
  type RiskStatus,
} from "@/domain/risks/types";
import { nextStatusesForRisk } from "@/domain/risks/lifecycle";

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

export function RiskDetailForms({
  slug,
  risk,
  members,
  canWrite,
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
}) {
  const controls = Array.isArray(risk.existingControlsJson)
    ? (risk.existingControlsJson as string[]).join("\n")
    : "";

  const canvasBound = saveRiskCanvasAction.bind(null, slug, risk.id);
  const assessBound = addRiskAssessmentAction.bind(null, slug, risk.id);
  const decisionBound = setRiskDecisionAction.bind(null, slug, risk.id);
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

  const next = nextStatusesForRisk(risk.status);

  return (
    <div className="flex flex-col gap-8">
      <form action={canvasAction} className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Canvas: causa → evento → efecto
        </h2>
        {canvasState.error ? (
          <p className="text-sm text-[var(--color-danger)]">{canvasState.error}</p>
        ) : null}
        {canvasState.ok ? (
          <p className="text-sm text-[var(--color-success)]">{canvasState.ok}</p>
        ) : null}
        <input
          name="title"
          defaultValue={risk.title}
          required
          disabled={!canWrite}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          name="cause"
          defaultValue={risk.cause}
          placeholder="Causa"
          disabled={!canWrite}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          name="event"
          defaultValue={risk.event}
          placeholder="Evento"
          disabled={!canWrite}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          name="effect"
          defaultValue={risk.effect}
          placeholder="Efecto"
          disabled={!canWrite}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <textarea
          name="existingControls"
          defaultValue={controls}
          rows={3}
          placeholder="Controles existentes (uno por línea)"
          disabled={!canWrite}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        {canWrite ? (
          <button
            type="submit"
            disabled={canvasPending}
            className="self-start rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white"
          >
            Guardar canvas
          </button>
        ) : null}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          Evaluaciones (versionadas)
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {risk.assessments.map((a) => (
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
          {risk.assessments.length === 0 ? (
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
            <input type="hidden" name="method" value="qualitative" />
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
              placeholder="Racional"
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
          Decisión de respuesta
        </h2>
        {risk.responseDecision ? (
          <p className="text-sm">
            Actual:{" "}
            <strong>
              {RISK_RESPONSE_LABELS[
                risk.responseDecision as RiskResponseDecision
              ] ?? risk.responseDecision}
            </strong>
            {risk.responseRationale ? ` — ${risk.responseRationale}` : null}
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
              defaultValue={risk.responseDecision ?? "mitigate"}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              {Object.entries(RISK_RESPONSE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              name="ownerUserId"
              required
              defaultValue={risk.responseOwnerUserId ?? ""}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              <option value="">Responsable…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <textarea
              name="rationale"
              required
              defaultValue={risk.responseRationale ?? ""}
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
                  risk.nextReviewAt
                    ? new Date(risk.nextReviewAt).toISOString().slice(0, 10)
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
            Estado: {RISK_STATUS_LABELS[risk.status]} →
          </span>
          {next.map((to) => (
            <button
              key={to}
              type="button"
              className="rounded-md border border-[var(--color-border)] px-3 py-1 text-sm"
              onClick={async () => {
                await transitionRiskAction(slug, risk.id, to);
              }}
            >
              {RISK_STATUS_LABELS[to]}
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
