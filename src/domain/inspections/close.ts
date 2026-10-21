import { addDays, diffDays } from "./dates";
import type { AssetStatus, EvalAnswer, EvalItem } from "./types";

export const MAX_BACKDATED_DAYS = 7;
export const MAX_PHOTOS_PER_ANSWER = 5;
export const MAX_PHOTOS_PER_INSPECTION = 40;

export type CloseBlockerCode =
  | "photo_required"
  | "comment_required"
  | "reading_lower_than_previous"
  | "date_in_future"
  | "date_too_old"
  | "asset_retired";

export type CloseBlocker = { code: CloseBlockerCode; message: string; itemId?: string };

/**
 * Bloqueos del cierre que no son del resultado: lo que falta para que la inspección sea evidencia.
 * `photoCounts` y `readings` vienen de la base; el resultado lo calcula `deriveInspectionResult`.
 */
export function validateInspectionForClose(input: {
  items: readonly EvalItem[];
  answers: readonly EvalAnswer[];
  /** Fotos por respuesta (clave: itemId). */
  photoCounts: Readonly<Record<string, number>>;
  inspectedAt: string;
  today: string;
  assetStatus?: AssetStatus | null;
  /** Lectura cargada y la última lectura cerrada del mismo activo, por tipo de lectura. */
  readings?: { current: number | null; previous: number | null; confirmedLower: boolean; label: string }[];
}): { ok: boolean; blockers: CloseBlocker[] } {
  const blockers: CloseBlocker[] = [];
  const answerOf = new Map(input.answers.map((a) => [a.itemId, a]));

  for (const item of input.items) {
    if (item.autoSource || (item.kind !== "check" && item.kind !== "number")) continue;
    const answer = answerOf.get(item.id);
    const isNc =
      answer?.value === "nonconform" ||
      (item.kind === "number" &&
        answer?.value !== "na" &&
        answer?.numberValue !== null &&
        answer?.numberValue !== undefined &&
        ((item.minValue !== null && item.minValue !== undefined && answer.numberValue < item.minValue) ||
          (item.maxValue !== null && item.maxValue !== undefined && answer.numberValue > item.maxValue)));
    if (!isNc) continue;
    if (item.photoOnNc === true && (input.photoCounts[item.id] ?? 0) === 0) {
      blockers.push({ code: "photo_required", itemId: item.id, message: "Falta la foto de una no conformidad. Si no se puede fotografiar, explicalo en el comentario." });
    }
    if (!answer?.comment?.trim()) {
      blockers.push({ code: "comment_required", itemId: item.id, message: "Falta el comentario de una no conformidad." });
    }
  }

  for (const r of input.readings ?? []) {
    if (r.current !== null && r.previous !== null && r.current < r.previous && !r.confirmedLower) {
      blockers.push({ code: "reading_lower_than_previous", message: `${r.label}: la lectura es menor que la anterior (${r.previous}). Confirmá que es correcta.` });
    }
  }

  if (input.inspectedAt > input.today) {
    blockers.push({ code: "date_in_future", message: "La fecha de la inspección no puede ser futura." });
  } else if (diffDays(input.inspectedAt, input.today) > MAX_BACKDATED_DAYS) {
    blockers.push({ code: "date_too_old", message: `La fecha no puede ser anterior a ${MAX_BACKDATED_DAYS} días (desde ${addDays(input.today, -MAX_BACKDATED_DAYS)}).` });
  }

  if (input.assetStatus === "retired") {
    blockers.push({ code: "asset_retired", message: "El activo está dado de baja: no se puede cerrar una inspección sobre él." });
  }

  return { ok: blockers.length === 0, blockers };
}
