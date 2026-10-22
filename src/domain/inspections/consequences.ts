import { addDays } from "./dates";
import type { StatusChange } from "./asset-status";
import { CRITICALITY_LABELS, type Criticality } from "./types";

/** Plazo propuesto para resolver una no conformidad, según la más grave: crítica 48 h, mayor 7 días, menor 30 días. */
export const FOLLOW_UP_DAYS: Record<Criticality, number> = { critical: 2, major: 7, minor: 30 };

const RANK: Record<Criticality, number> = { critical: 3, major: 2, minor: 1 };

export type NonconformingItem = { code: string; text: string; criticality: Criticality; comment: string | null };

export function highestCriticality(items: readonly Pick<NonconformingItem, "criticality">[]): Criticality | null {
  let top: Criticality | null = null;
  for (const item of items) if (!top || RANK[item.criticality] > RANK[top]) top = item.criticality;
  return top;
}

/** Fecha límite propuesta (AAAA-MM-DD), contada desde el día del cierre. */
export function followUpDueDate(today: string, criticality: Criticality): string {
  return addDays(today, FOLLOW_UP_DAYS[criticality]);
}

export type FollowUpPlan = {
  action: { title: string; description: string; criticality: Criticality } | null;
  finding: { title: string; description: string; severity: string } | null;
};

function bullets(items: readonly NonconformingItem[]): string {
  return items.map((i) => `• ${i.text} (${CRITICALITY_LABELS[i.criticality].toLowerCase()})${i.comment?.trim() ? `: ${i.comment.trim()}` : ""}`).join("\n");
}

/** Pasos extra cuando el activo sale de servicio: retirar, señalizar, reponer o destruir. */
export function statusSteps(change: StatusChange | null, typeKey: string | null): string[] {
  if (!change) return [];
  if (change.to === "retired") return ["Dar de baja el equipo, destruirlo y adjuntar la foto de la destrucción."];
  if (change.to === "out_of_service") {
    return ["Retirar y señalizar el equipo: queda fuera de servicio hasta una reinspección apta.", ...(typeKey === "extinguisher" ? ["Reponer el extintor por uno vigente."] : [])];
  }
  return [];
}

/**
 * Qué se crea al cerrar una inspección con no conformidades: una acción de seguimiento (siempre que haya alguna)
 * y, si la plantilla lo pide y hay una crítica, un hallazgo en borrador. El hallazgo no se publica solo.
 */
export function planFollowUp(input: {
  subjectLabel: string;
  nonconforming: readonly NonconformingItem[];
  statusChange: StatusChange | null;
  typeKey: string | null;
  findingOnCritical: boolean;
}): FollowUpPlan {
  const top = highestCriticality(input.nonconforming);
  if (!top) return { action: null, finding: null };

  const steps = statusSteps(input.statusChange, input.typeKey);
  const description = [`No conformidades de la inspección de ${input.subjectLabel}:`, bullets(input.nonconforming), ...(steps.length ? ["", "Además:", ...steps.map((s) => `• ${s}`)] : [])].join("\n");
  const action = { title: `Resolver no conformidades: ${input.subjectLabel}`, description, criticality: top };

  const critical = input.nonconforming.filter((i) => i.criticality === "critical");
  const finding =
    input.findingOnCritical && critical.length > 0
      ? {
          title: `No apto en inspección: ${input.subjectLabel}`,
          description: `${critical.length === 1 ? "Ítem crítico que no cumple" : "Ítems críticos que no cumplen"} en la inspección de ${input.subjectLabel}:\n${bullets(critical)}`,
          severity: "Crítica",
        }
      : null;
  return { action, finding };
}
