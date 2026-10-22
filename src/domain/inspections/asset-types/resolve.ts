import { addMonths } from "../dates";
import { isIsoDate } from "../dates";
import type { AssetTypeDef } from "./index";

export type DueInput = { kind: string; lastDoneAt?: string | null; dueAt?: string | null; reference?: string | null };

export type ResolvedDueDate = {
  kind: string;
  label: string;
  dueAt: string;
  lastDoneAt: string | null;
  reference: string | null;
  leadDays: number;
  blocking: boolean;
};

export type FieldIssue = { field: string; message: string };

/**
 * Convierte lo que se cargó (última fecha hecha o vencimiento) en los vencimientos del activo.
 * Una fecha de vencimiento cargada manda; si solo hay última fecha se le suma el intervalo del tipo.
 * Sin ninguna, el vencimiento obligatorio es un error y el opcional simplemente no se registra
 * (la prueba hidráulica parte de la fecha de fabricación).
 */
export function resolveDueDates(
  type: AssetTypeDef,
  attributes: Record<string, unknown>,
  inputs: readonly DueInput[],
): { dueDates: ResolvedDueDate[]; issues: FieldIssue[] } {
  const dueDates: ResolvedDueDate[] = [];
  const issues: FieldIssue[] = [];
  const manufacturedAt = typeof attributes.manufacturedAt === "string" ? attributes.manufacturedAt : null;

  for (const spec of type.dueKinds(attributes)) {
    const input = inputs.find((i) => i.kind === spec.kind);
    const last = input?.lastDoneAt?.trim() || null;
    const due = input?.dueAt?.trim() || null;
    if (last && !isIsoDate(last)) {
      issues.push({ field: spec.kind, message: `${spec.label}: fecha inválida` });
      continue;
    }
    if (due && !isIsoDate(due)) {
      issues.push({ field: spec.kind, message: `${spec.label}: fecha de vencimiento inválida` });
      continue;
    }
    let dueAt = due;
    let lastDoneAt = last;
    if (!dueAt && last) dueAt = addMonths(last, spec.intervalMonths);
    if (!dueAt && spec.defaultFromManufacture && manufacturedAt && isIsoDate(manufacturedAt)) {
      dueAt = addMonths(manufacturedAt, spec.intervalMonths);
      lastDoneAt = lastDoneAt ?? manufacturedAt;
    }
    if (!dueAt) {
      if (spec.required) issues.push({ field: spec.kind, message: `${spec.label}: indicá la última fecha o el vencimiento` });
      continue;
    }
    dueDates.push({
      kind: spec.kind,
      label: spec.label,
      dueAt,
      lastDoneAt,
      reference: input?.reference?.trim() || null,
      leadDays: spec.leadDays,
      blocking: spec.blocking,
    });
  }
  return { dueDates, issues };
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9 ._/-]*$/;

/** Código del activo: se guarda en mayúsculas, sin espacios de más, hasta 30 caracteres. */
export function normalizeAssetCode(raw: string): { ok: true; code: string } | { ok: false; message: string } {
  const code = raw.replace(/\s+/g, " ").trim().toUpperCase();
  if (!code) return { ok: false, message: "El código es obligatorio" };
  if (code.length > 30) return { ok: false, message: "El código admite hasta 30 caracteres" };
  if (!CODE_PATTERN.test(code)) return { ok: false, message: "El código admite letras, números, espacios y . _ / -" };
  return { ok: true, code };
}
