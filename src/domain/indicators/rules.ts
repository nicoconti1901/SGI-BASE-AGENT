import {
  MEASUREMENT_GRACE_DAYS,
  type IndicatorDirection,
  type IndicatorFrequency,
  type MeasurementStatus,
} from "@/domain/indicators/types";

// ─── Estado de una medición (determinista: 9001:2026 pide software confiable) ──

export type IndicatorTarget = {
  direction: IndicatorDirection;
  target: number;
  alertThreshold: number | null;
};

/**
 * Mayor es mejor: valor < meta → fuera; meta ≤ valor < alerta → alerta; resto en meta.
 * Menor es mejor: valor > meta → fuera; alerta < valor ≤ meta → alerta; resto en meta.
 */
export function measurementStatus(def: IndicatorTarget, value: number): MeasurementStatus {
  if (!Number.isFinite(value)) return "no_data";
  if (def.direction === "higher_better") {
    if (value < def.target) return "off_target";
    if (def.alertThreshold !== null && value < def.alertThreshold) return "alert";
    return "on_target";
  }
  if (value > def.target) return "off_target";
  if (def.alertThreshold !== null && value > def.alertThreshold) return "alert";
  return "on_target";
}

/** La alerta tiene que avisar antes de salir de la meta: del lado "bueno". */
export function indicatorDefinitionIssues(def: IndicatorTarget & { name: string; unit: string }): string[] {
  const issues: string[] = [];
  if (def.name.trim().length < 3) issues.push("Poné un nombre al indicador");
  if (!def.unit.trim()) issues.push("Indicá la unidad (%, casos, horas…)");
  if (!Number.isFinite(def.target)) issues.push("Definí la meta con un número");
  if (def.alertThreshold !== null) {
    if (!Number.isFinite(def.alertThreshold)) {
      issues.push("El umbral de alerta tiene que ser un número");
    } else if (def.direction === "higher_better" && def.alertThreshold <= def.target) {
      issues.push("Si mayor es mejor, la alerta tiene que ser mayor que la meta (avisa antes de no cumplirla)");
    } else if (def.direction === "lower_better" && def.alertThreshold >= def.target) {
      issues.push("Si menor es mejor, la alerta tiene que ser menor que la meta (avisa antes de no cumplirla)");
    }
  }
  return issues;
}

/** El peor estado de los indicadores con datos (supuesto 3). */
export function aggregateStatus(statuses: MeasurementStatus[]): MeasurementStatus {
  const withData = statuses.filter((s) => s !== "no_data");
  if (withData.length === 0) return "no_data";
  if (withData.includes("off_target")) return "off_target";
  if (withData.includes("alert")) return "alert";
  return "on_target";
}

// ─── Períodos ────────────────────────────────────────────────────────────────

const MONTHS_PER_PERIOD: Record<IndicatorFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export type Period = { key: string; start: Date; end: Date; label: string };

const MONTH_NAMES = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Período (UTC) que contiene la fecha. `end` es exclusivo. */
export function periodOf(frequency: IndicatorFrequency, date: Date): Period {
  const size = MONTHS_PER_PERIOD[frequency];
  const year = date.getUTCFullYear();
  const index = Math.floor(date.getUTCMonth() / size);
  return buildPeriod(frequency, year, index);
}

function buildPeriod(frequency: IndicatorFrequency, year: number, index: number): Period {
  const size = MONTHS_PER_PERIOD[frequency];
  const start = new Date(Date.UTC(year, index * size, 1));
  const end = new Date(Date.UTC(year, (index + 1) * size, 1));
  const key =
    frequency === "monthly"
      ? `${year}-${String(index + 1).padStart(2, "0")}`
      : frequency === "quarterly"
        ? `${year}-T${index + 1}`
        : frequency === "semiannual"
          ? `${year}-S${index + 1}`
          : `${year}`;
  const label =
    frequency === "monthly"
      ? `${MONTH_NAMES[index]} ${year}`
      : frequency === "quarterly"
        ? `${index + 1}.º trimestre ${year}`
        : frequency === "semiannual"
          ? `${index + 1}.º semestre ${year}`
          : `${year}`;
  return { key, start, end, label };
}

export function nextPeriod(frequency: IndicatorFrequency, period: Period): Period {
  return periodOf(frequency, period.end);
}

export function previousPeriod(frequency: IndicatorFrequency, period: Period): Period {
  return periodOf(frequency, new Date(period.start.getTime() - 1));
}

/**
 * Próximo período a cargar: el siguiente al último cargado; si no hay cargas,
 * el período en que se creó el indicador.
 */
export function nextPendingPeriod(input: {
  frequency: IndicatorFrequency;
  lastLoadedStart: Date | null;
  createdAt: Date;
}): Period {
  if (input.lastLoadedStart) {
    return nextPeriod(input.frequency, periodOf(input.frequency, input.lastLoadedStart));
  }
  return periodOf(input.frequency, input.createdAt);
}

/** Vence 10 días después del fin del período (supuesto 1). */
export function measurementDueAt(period: Period): Date {
  const due = new Date(period.end);
  due.setUTCDate(due.getUTCDate() + MEASUREMENT_GRACE_DAYS);
  return due;
}

/** Un período se carga cuando terminó (o está en curso, para adelantar). No a futuro. */
export function measurementIssues(input: {
  period: Period;
  now: Date;
  alreadyLoaded: boolean;
  status: MeasurementStatus;
  analysis: string | null | undefined;
}): string[] {
  const issues: string[] = [];
  if (input.alreadyLoaded) {
    issues.push("Ese período ya está cargado: corregí el valor existente");
  }
  if (input.period.start > input.now) issues.push("No se pueden cargar períodos futuros");
  if (input.status === "off_target" && !input.analysis?.trim()) {
    issues.push("El valor está fuera de meta: escribí el análisis del desvío (por qué pasó)");
  }
  return issues;
}

export function correctionIssues(reason: string | null | undefined): string[] {
  return reason?.trim() ? [] : ["Indicá el motivo de la corrección"];
}

/** Código correlativo por año: OBJ-2026-03. */
export function objectiveCode(year: number, sequence: number): string {
  return `OBJ-${year}-${String(sequence).padStart(2, "0")}`;
}
