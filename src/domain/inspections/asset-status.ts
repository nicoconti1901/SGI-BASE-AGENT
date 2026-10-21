import type { AssetStatus, InspectionResult } from "./types";

export type StatusPolicy = { retireOnUnfit: boolean; canReinstate: boolean };

export type StatusReasonCode =
  | "inspection_unfit"
  | "inspection_unfit_retired"
  | "reinstated"
  | "correction_unfit"
  | "correction_unfit_retired";

export type StatusChange = { from: AssetStatus; to: AssetStatus; reasonCode: StatusReasonCode };

export const STATUS_REASON_LABELS: Record<StatusReasonCode | "created" | "retired_manual" | "reactivated_manual", string> = {
  created: "Alta del activo",
  inspection_unfit: "Inspección no apta",
  inspection_unfit_retired: "Inspección no apta: baja definitiva",
  reinstated: "Reinspección apta: vuelve a servicio",
  correction_unfit: "Corrección de una inspección: ahora no apta",
  correction_unfit_retired: "Corrección de una inspección: ahora no apta, baja definitiva",
  retired_manual: "Baja manual",
  reactivated_manual: "Reactivación manual",
};

/**
 * Estado del activo después de una inspección cerrada (o de la corrección de la última cerrada).
 * No hay procesos que cambien estados solos: este resultado se aplica en la transacción del cierre.
 */
export function assetStatusAfter(input: {
  current: AssetStatus;
  result: InspectionResult;
  policy: StatusPolicy;
  /** El usuario tiene rol de responsable de proceso o superior. */
  canRelease: boolean;
  origin: "close" | "correction";
}): { status: AssetStatus; change: StatusChange | null } {
  const { current, result, policy, canRelease, origin } = input;
  const keep = { status: current, change: null } as const;

  if (current === "retired") return keep;

  if (result === "unfit") {
    const suffix = origin === "correction" ? "correction_unfit" : "inspection_unfit";
    if (policy.retireOnUnfit) {
      return {
        status: "retired",
        change: { from: current, to: "retired", reasonCode: origin === "correction" ? "correction_unfit_retired" : "inspection_unfit_retired" },
      };
    }
    if (current === "out_of_service") return keep;
    return { status: "out_of_service", change: { from: current, to: "out_of_service", reasonCode: suffix } };
  }

  // Apto o apto con observaciones.
  if (origin === "correction") return keep; // liberar exige una reinspección, no una corrección
  if (current === "out_of_service" && policy.canReinstate && canRelease) {
    return { status: "in_service", change: { from: current, to: "in_service", reasonCode: "reinstated" } };
  }
  return keep;
}

/** Un activo fuera de servicio con una reinspección apta cargada por quien no puede liberarlo. */
export function isPendingRelease(input: {
  status: AssetStatus;
  lastResult: InspectionResult | null;
  policy: StatusPolicy;
}): boolean {
  return input.status === "out_of_service" && input.policy.canReinstate && (input.lastResult === "fit" || input.lastResult === "fit_with_observations");
}
