import { MASTER_DATA_ENTITY_LABELS, type MasterDataEntity } from "./types";

export type DeactivationCheck = { allowed: true } | { allowed: false; message: string };

/**
 * Una sede, puesto o tarea no se da de baja mientras tenga personas activas asociadas.
 * `dependents` son los nombres (o legajos) de quienes dependen; se muestran tal cual.
 */
export function canDeactivate(entity: MasterDataEntity, dependents: string[]): DeactivationCheck {
  if (dependents.length === 0) return { allowed: true };
  const shown = dependents.slice(0, 5).join(", ");
  const more = dependents.length > 5 ? ` y ${dependents.length - 5} más` : "";
  return {
    allowed: false,
    message: `No se puede dar de baja: ${dependents.length} persona(s) activa(s) usan esta ${MASTER_DATA_ENTITY_LABELS[entity]} (${shown}${more}). Reasignalas primero.`,
  };
}

/** El DNI es opcional; si viene, solo dígitos (7 a 9) una vez sin puntos ni espacios. */
export function isValidDocumentId(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^\d{7,9}$/.test(value.replace(/[.\s]/g, ""));
}
