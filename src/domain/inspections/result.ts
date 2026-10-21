import {
  InspectionDomainError,
  type AppliesWhen,
  type AutoSource,
  type Criticality,
  type EvalAnswer,
  type EvalItem,
  type InspectionResult,
} from "./types";

export type ConditionContext = {
  asset?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

export function evaluateCondition(cond: AppliesWhen, ctx: ConditionContext): boolean {
  const value = (cond.source === "asset" ? ctx.asset : ctx.context)?.[cond.key];
  if ("equals" in cond) return value === cond.equals;
  if ("notEquals" in cond) return value !== cond.notEquals;
  if ("in" in cond) return cond.in.includes(value as string | number);
  return !cond.notIn.includes(value as string | number);
}

/** Deja solo los ítems que aplican al activo o al contexto de la inspección. */
export function applicableItems<T extends { appliesWhen?: AppliesWhen | null }>(items: readonly T[], ctx: ConditionContext): T[] {
  return items.filter((item) => !item.appliesWhen || evaluateCondition(item.appliesWhen, ctx));
}

/**
 * Un ítem automático está conforme si el vencimiento existe y no pasó (hasta el día inclusive).
 * Sin vencimiento cargado no hay forma de saber que está vigente: se toma como no conforme.
 */
export function resolveAutoConform(
  source: AutoSource,
  dueDates: readonly { kind: string; dueAt: string }[],
  today: string,
): boolean {
  const due = dueDates.find((d) => d.kind === source.dueKind);
  return Boolean(due && due.dueAt >= today);
}

export type DerivedResult = {
  complete: boolean;
  missingItemIds: string[];
  applicable: number;
  conform: number;
  nonconform: number;
  nonconformByCriticality: Record<Criticality, number>;
  /** Informativo: conformes / aplicables, un decimal. Nulo si la inspección está incompleta. */
  scorePct: number | null;
  result: InspectionResult | null;
};

const SCORING = new Set(["check", "number"]);

/** Valor efectivo de un ítem puntuable: "conform", "nonconform", "na" o null (sin responder). */
function effectiveValue(item: EvalItem, answer: EvalAnswer | undefined): "conform" | "nonconform" | "na" | null {
  if (item.autoSource) return item.autoConform === true ? "conform" : "nonconform";
  if (!answer) return null;
  if (answer.value === "na") return "na";
  if (item.kind === "check") return answer.value ?? null;
  // number: el valor se deriva del número cargado.
  if (answer.numberValue === null || answer.numberValue === undefined || Number.isNaN(answer.numberValue)) return null;
  const { minValue: min, maxValue: max } = item;
  const outside = (min !== null && min !== undefined && answer.numberValue < min) || (max !== null && max !== undefined && answer.numberValue > max);
  return outside ? "nonconform" : "conform";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Resultado de una inspección a partir de los ítems aplicables y las respuestas.
 * El resultado y el puntaje nunca se cargan a mano: salen de acá.
 */
export function deriveInspectionResult(items: readonly EvalItem[], answers: readonly EvalAnswer[]): DerivedResult {
  const byItem = new Map<string, EvalAnswer>();
  const known = new Map(items.map((i) => [i.id, i]));
  for (const answer of answers) {
    const item = known.get(answer.itemId);
    if (!item) throw new InspectionDomainError("unknown_item", `La respuesta es de un ítem que no aplica (${answer.itemId})`);
    if (byItem.has(answer.itemId)) throw new InspectionDomainError("duplicate_answer", `Hay dos respuestas para el mismo ítem (${answer.itemId})`);
    if (answer.value === "na" && !item.naAllowed) {
      throw new InspectionDomainError("na_not_allowed", `El ítem ${answer.itemId} no admite «No aplica»`);
    }
    byItem.set(answer.itemId, answer);
  }

  const missingItemIds: string[] = [];
  const byCrit: Record<Criticality, number> = { critical: 0, major: 0, minor: 0 };
  let applicable = 0;
  let conform = 0;
  let nonconform = 0;

  for (const item of items) {
    const answer = byItem.get(item.id);
    if (!SCORING.has(item.kind)) {
      if (!item.required) continue;
      const filled =
        item.kind === "reading"
          ? answer?.numberValue !== null && answer?.numberValue !== undefined
          : Boolean(answer?.textValue?.trim());
      if (!filled) missingItemIds.push(item.id);
      continue;
    }
    const value = effectiveValue(item, answer);
    if (value === null) {
      missingItemIds.push(item.id);
      continue;
    }
    if (value === "na") continue;
    applicable++;
    if (value === "conform") conform++;
    else {
      nonconform++;
      byCrit[item.criticality]++;
    }
  }

  if (missingItemIds.length > 0) {
    return { complete: false, missingItemIds, applicable, conform, nonconform, nonconformByCriticality: byCrit, scorePct: null, result: null };
  }
  if (applicable === 0) {
    throw new InspectionDomainError("no_applicable_items", "No hay ningún ítem aplicable: no se puede calcular el resultado");
  }
  const result: InspectionResult = byCrit.critical > 0 ? "unfit" : nonconform > 0 ? "fit_with_observations" : "fit";
  return {
    complete: true,
    missingItemIds,
    applicable,
    conform,
    nonconform,
    nonconformByCriticality: byCrit,
    scorePct: round1((conform / applicable) * 100),
    result,
  };
}

/** Frase corta que explica el resultado, para la pantalla de cierre. */
export function explainResult(d: Pick<DerivedResult, "result" | "nonconformByCriticality">): string {
  const { critical, major, minor } = d.nonconformByCriticality;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (d.result === "unfit") return `No apto porque ${plural(critical, "ítem crítico no cumple", "ítems críticos no cumplen")}.`;
  if (d.result === "fit_with_observations") {
    const parts = [major > 0 ? plural(major, "ítem mayor", "ítems mayores") : "", minor > 0 ? plural(minor, "ítem menor", "ítems menores") : ""].filter(Boolean);
    return `Apto con observaciones: ${parts.join(" y ")} no cumple${major + minor === 1 ? "" : "n"}, ninguno crítico.`;
  }
  if (d.result === "fit") return "Apto: todo lo aplicable cumple.";
  return "Falta responder algunos ítems.";
}
