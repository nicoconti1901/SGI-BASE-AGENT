import type { IndicatorDirection, MeasurementStatus } from "@/domain/indicators/types";

/** Unidades frecuentes: se eligen con un clic en lugar de escribirlas. */
export const UNIT_SUGGESTIONS = ["%", "casos", "días", "horas", "unidades", "$"];

function fmt(n: number, unit: string): string {
  const value = n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return unit === "%" ? `${value} %` : `${value} ${unit}`.trim();
}

/** Umbral sugerido: un 5 % antes de la meta, del lado bueno (donde measurementStatus avisa). */
export function suggestAlertThreshold(direction: IndicatorDirection, target: number): number | null {
  if (!Number.isFinite(target)) return null;
  const margin = target === 0 ? 1 : Math.abs(target) * 0.05;
  const raw = direction === "higher_better" ? target + margin : target - margin;
  return Math.round(raw * 100) / 100;
}

/** El semáforo del indicador en palabras: qué valores quedan en meta, en alerta y fuera de meta. */
export function statusBands(def: {
  direction: IndicatorDirection;
  target: number;
  alertThreshold: number | null;
  unit: string;
}): { status: MeasurementStatus; text: string }[] {
  const { direction, target: t, alertThreshold: a, unit } = def;
  if (!Number.isFinite(t)) return [];
  const alert = a !== null && Number.isFinite(a) ? a : null;
  if (direction === "higher_better") {
    return [
      { status: "on_target", text: `${fmt(alert ?? t, unit)} o más` },
      ...(alert !== null ? [{ status: "alert" as const, text: `desde ${fmt(t, unit)} hasta menos de ${fmt(alert, unit)}` }] : []),
      { status: "off_target", text: `menos de ${fmt(t, unit)}` },
    ];
  }
  return [
    { status: "on_target", text: `${fmt(alert ?? t, unit)} o menos` },
    ...(alert !== null ? [{ status: "alert" as const, text: `más de ${fmt(alert, unit)} hasta ${fmt(t, unit)}` }] : []),
    { status: "off_target", text: `más de ${fmt(t, unit)}` },
  ];
}
