import type { Tx } from "@/lib/inspection-support";
import { onFunctionalCheckClosed } from "@/lib/functional-check";
import { FUNCTIONAL_CHECK_TEMPLATE_KEY } from "@/domain/calibration/types";
import type { InspectionResult } from "@/domain/inspections/types";

export type CloseHookInput = {
  tenantId: string;
  actorUserId: string;
  inspection: { id: string; assetId: string | null; inspectedAt: string };
  result: InspectionResult;
};

type CloseHook = (tx: Tx, input: CloseHookInput) => Promise<void>;

/**
 * Punto de extensión del motor de inspecciones: lo que un módulo necesita hacer, en la misma transacción, cuando se cierra
 * (o se corrige a «no apta») una inspección de una plantilla suya. Sumar un módulo = una línea acá.
 */
const CLOSE_HOOKS: Record<string, CloseHook> = {
  [FUNCTIONAL_CHECK_TEMPLATE_KEY]: onFunctionalCheckClosed,
};

export async function runInspectionCloseHooks(tx: Tx, templateKey: string, input: CloseHookInput) {
  const hook = CLOSE_HOOKS[templateKey];
  if (hook) await hook(tx, input);
}
