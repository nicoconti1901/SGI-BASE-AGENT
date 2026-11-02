import type { RiskResponseDecision, RiskStatus } from "@/domain/risks/types";
import type { OpportunityStatus } from "@/domain/opportunities/types";

/**
 * Dónde está un riesgo u oportunidad, qué falta para avanzar y quién tiene que hacerlo.
 * Alimenta la ficha del detalle: etapas completas en modo lectura, lo pendiente resaltado.
 */
export type StageKey = "describe" | "assess" | "decide" | "act" | "review";
export type StageState = "done" | "current" | "todo";
export type ProgressStage = { key: StageKey; label: string; state: StageState };

/** creator = quien lo registró; owner = responsable de la respuesta (riesgo) o de perseguirla (oportunidad). */
export type ProgressActor = "creator" | "owner" | "none";

export type RecordProgress<S extends string> = {
  stages: ProgressStage[];
  nextStep: string;
  who: ProgressActor;
  /** Lo que impide avanzar, en palabras del usuario. */
  missing: string[];
  /** Cambio de estado manual que corresponde ahora (los demás pasan solos al guardar). */
  advance: { to: S; label: string } | null;
};

export type ActionSnapshot = { status: string; effectivenessStatus: string };

/** Respuestas que solo se cumplen ejecutando algo: piden al menos una acción. */
export const RISK_DECISIONS_WITH_ACTIONS: readonly RiskResponseDecision[] = ["mitigate", "transfer", "avoid"];

function stagesFrom(labels: [StageKey, string][], done: Record<StageKey, boolean>, closed: boolean): ProgressStage[] {
  const firstOpen = closed ? -1 : labels.findIndex(([key]) => !done[key]);
  return labels.map(([key, label], i) => ({
    key,
    label,
    state: done[key] ? "done" : i === firstOpen ? "current" : "todo",
  }));
}

function openCount(actions: ActionSnapshot[]): number {
  return actions.filter((a) => a.status === "open" || a.status === "in_progress").length;
}

function pendingEffectiveness(actions: ActionSnapshot[]): number {
  return actions.filter((a) => a.status === "completed" && a.effectivenessStatus === "pending").length;
}

export function riskProgress(input: {
  status: RiskStatus;
  statementComplete: boolean;
  assessments: number;
  decision: RiskResponseDecision | null;
  actions: ActionSnapshot[];
}): RecordProgress<RiskStatus> {
  const { status, actions } = input;
  const decided = Boolean(input.decision) && !["identified", "analyzing", "evaluated"].includes(status);
  const needsActions = input.decision ? RISK_DECISIONS_WITH_ACTIONS.includes(input.decision) : false;
  const open = openCount(actions);
  const pending = pendingEffectiveness(actions);
  const done: Record<StageKey, boolean> = {
    describe: input.statementComplete,
    assess: input.assessments > 0,
    decide: decided,
    act: decided && (!needsActions || (actions.length > 0 && open === 0)),
    review: status === "monitored" || status === "closed",
  };
  const stages = stagesFrom(
    [
      ["describe", "Descripción"],
      ["assess", "Evaluación"],
      ["decide", "Respuesta"],
      ["act", "Acciones"],
      ["review", "Eficacia y seguimiento"],
    ],
    done,
    status === "closed",
  );
  const describeHint = input.statementComplete ? [] : ["Falta completar causa, evento y efecto: sin eso la evaluación no se puede justificar."];

  switch (status) {
    case "identified":
    case "analyzing":
      return { stages, nextStep: "Evaluar el nivel del riesgo", who: "creator", missing: [...describeHint, "Sin evaluación no se puede decidir la respuesta."], advance: null };
    case "evaluated":
      return { stages, nextStep: "Decidir la respuesta al riesgo", who: "creator", missing: ["Falta decidir la respuesta y su responsable."], advance: null };
    case "response_planned":
      if (needsActions && actions.length === 0) {
        return { stages, nextStep: "Cargar las acciones de la respuesta", who: "owner", missing: ["La respuesta elegida necesita al menos una acción."], advance: null };
      }
      return { stages, nextStep: "Iniciar la implementación", who: "owner", missing: [], advance: { to: "implementing", label: "Iniciar implementación" } };
    case "implementing":
      if (open > 0) {
        return { stages, nextStep: `Completar ${open === 1 ? "la acción pendiente" : `las ${open} acciones pendientes`}`, who: "owner", missing: [`${open} ${open === 1 ? "acción sin completar" : "acciones sin completar"}.`], advance: null };
      }
      return { stages, nextStep: "Pasar a revisión de eficacia", who: "owner", missing: [], advance: { to: "effectiveness_review", label: "Pasar a revisión de eficacia" } };
    case "effectiveness_review":
      if (pending > 0) {
        return { stages, nextStep: "Evaluar si las acciones fueron eficaces", who: "owner", missing: [`${pending} ${pending === 1 ? "acción sin evaluar" : "acciones sin evaluar"} su eficacia.`], advance: null };
      }
      return { stages, nextStep: "Dejar el riesgo en seguimiento", who: "owner", missing: [], advance: { to: "monitored", label: "Pasar a seguimiento" } };
    case "monitored":
      return { stages, nextStep: "Revisarlo en la próxima fecha prevista", who: "owner", missing: [], advance: { to: "analyzing", label: "Volver a evaluar" } };
    case "closed":
      return { stages, nextStep: "Cerrado: no requiere más pasos", who: "none", missing: [], advance: null };
  }
}

export function opportunityProgress(input: {
  status: OpportunityStatus;
  statementComplete: boolean;
  assessments: number;
  decided: boolean;
  actions: ActionSnapshot[];
}): RecordProgress<OpportunityStatus> {
  const { status, actions } = input;
  const decided = input.decided && !["discovered", "analyzing", "evaluated"].includes(status);
  const open = openCount(actions);
  const done: Record<StageKey, boolean> = {
    describe: input.statementComplete,
    assess: input.assessments > 0,
    decide: decided,
    act: ["benefit_review", "realized", "closed"].includes(status),
    review: status === "realized" || status === "closed",
  };
  const stages = stagesFrom(
    [
      ["describe", "Descripción"],
      ["assess", "Evaluación"],
      ["decide", "Decisión"],
      ["act", "Acciones"],
      ["review", "Beneficio"],
    ],
    done,
    status === "closed",
  );
  const describeHint = input.statementComplete ? [] : ["Falta completar situación, circunstancia y beneficio esperado."];

  switch (status) {
    case "discovered":
    case "analyzing":
      return { stages, nextStep: "Evaluar el valor de la oportunidad", who: "creator", missing: [...describeHint, "Sin evaluación no se puede decidir si se persigue."], advance: null };
    case "evaluated":
      return { stages, nextStep: "Decidir si se persigue", who: "creator", missing: ["Falta la decisión y su responsable."], advance: null };
    case "decision":
      return { stages, nextStep: "Revisar la decisión en la fecha prevista", who: "owner", missing: [], advance: { to: "pursuing", label: "Perseguirla ahora" } };
    case "pursuing":
      if (actions.length === 0) {
        return { stages, nextStep: "Cargar las acciones para aprovecharla", who: "owner", missing: ["Perseguir la oportunidad necesita al menos una acción."], advance: null };
      }
      return { stages, nextStep: "Iniciar la implementación", who: "owner", missing: [], advance: { to: "implementing", label: "Iniciar implementación" } };
    case "implementing":
      if (open > 0) {
        return { stages, nextStep: `Completar ${open === 1 ? "la acción pendiente" : `las ${open} acciones pendientes`}`, who: "owner", missing: [`${open} ${open === 1 ? "acción sin completar" : "acciones sin completar"}.`], advance: null };
      }
      return { stages, nextStep: "Revisar si se obtuvo el beneficio", who: "owner", missing: [], advance: { to: "benefit_review", label: "Pasar a revisión de beneficio" } };
    case "benefit_review":
      return { stages, nextStep: "Confirmar que el beneficio se logró", who: "owner", missing: [], advance: { to: "realized", label: "Beneficio logrado" } };
    case "realized":
      return { stages, nextStep: "Cerrar la oportunidad", who: "owner", missing: [], advance: { to: "closed", label: "Cerrar oportunidad" } };
    case "closed":
      return { stages, nextStep: "Cerrada: no requiere más pasos", who: "none", missing: [], advance: null };
  }
}
