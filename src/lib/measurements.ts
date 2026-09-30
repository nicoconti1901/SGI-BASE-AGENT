import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ObjectiveGateError, syncIndicatorDue } from "@/lib/objectives";
import {
  correctionIssues,
  measurementIssues,
  measurementStatus,
  nextPendingPeriod,
  periodOf,
  type Period,
} from "@/domain/indicators/rules";
import { MEASUREMENT_STATUS_LABELS } from "@/domain/indicators/types";

type Db = PrismaClient;

/** Cargan valores: el responsable del indicador, el administrador o un responsable de proceso. */
export function canLoadIndicator(input: { userId: string; ownerUserId: string; canManage: boolean }): boolean {
  return input.canManage || input.userId === input.ownerUserId;
}

async function findLoadableIndicator(tenantId: string, indicatorId: string, db: Db) {
  const indicator = await db.indicator.findFirst({
    where: { id: indicatorId, tenantId },
    include: {
      objective: { select: { id: true, status: true } },
      measurements: { orderBy: { periodStart: "desc" }, take: 1, select: { periodStart: true } },
    },
  });
  if (!indicator) throw new Error("Indicador no encontrado");
  if (indicator.objective.status !== "active") {
    throw new ObjectiveGateError(["El objetivo ya está cerrado: no se cargan más valores"]);
  }
  if (!indicator.active) throw new ObjectiveGateError(["El indicador está desactivado"]);
  return indicator;
}

// ─── Consulta ───────────────────────────────────────────────────────────────

export async function getIndicatorDetail(tenantId: string, indicatorId: string, db: Db = prisma) {
  const indicator = await db.indicator.findFirst({
    where: { id: indicatorId, tenantId },
    include: {
      objective: { select: { id: true, code: true, title: true, status: true } },
      measurements: {
        orderBy: { periodStart: "desc" },
        include: { corrections: { orderBy: { createdAt: "desc" } } },
      },
    },
  });
  if (!indicator) return null;
  const pending = nextPendingPeriod({
    frequency: indicator.frequency,
    lastLoadedStart: indicator.measurements[0]?.periodStart ?? null,
    createdAt: indicator.createdAt,
  });
  return { indicator, pendingPeriod: pending };
}

// ─── Carga por período ──────────────────────────────────────────────────────

/** Carga el próximo período pendiente. Fuera de meta exige el análisis del desvío. */
export async function recordMeasurement(
  input: {
    tenantId: string;
    indicatorId: string;
    userId: string;
    value: number;
    analysis: string | null;
    now?: Date;
  },
  db: Db = prisma,
) {
  const indicator = await findLoadableIndicator(input.tenantId, input.indicatorId, db);
  if (!Number.isFinite(input.value)) throw new ObjectiveGateError(["Ingresá el valor con un número"]);

  const period = nextPendingPeriod({
    frequency: indicator.frequency,
    lastLoadedStart: indicator.measurements[0]?.periodStart ?? null,
    createdAt: indicator.createdAt,
  });
  const status = measurementStatus(indicator, input.value);
  const issues = measurementIssues({
    period,
    now: input.now ?? new Date(),
    alreadyLoaded: false,
    status,
    analysis: input.analysis,
  });
  if (issues.length > 0) throw new ObjectiveGateError(issues);

  try {
    const measurement = await db.measurement.create({
      data: {
        tenantId: input.tenantId,
        indicatorId: indicator.id,
        periodKey: period.key,
        periodStart: period.start,
        value: input.value,
        status: status === "no_data" ? "on_target" : status,
        analysis: input.analysis?.trim() || null,
        recordedByUserId: input.userId,
      },
    });
    await syncIndicatorDue(indicator.id, db);
    return measurement;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ObjectiveGateError(["Ese período ya está cargado: corregí el valor existente"]);
    }
    throw error;
  }
}

/** Corregir deja registro (valor anterior, quién, motivo) y recalcula el estado. */
export async function correctMeasurement(
  input: {
    tenantId: string;
    measurementId: string;
    userId: string;
    newValue: number;
    reason: string;
    analysis: string | null;
  },
  db: Db = prisma,
) {
  const measurement = await db.measurement.findFirst({
    where: { id: input.measurementId, tenantId: input.tenantId },
  });
  if (!measurement) throw new Error("Medición no encontrada");
  const indicator = await findLoadableIndicator(input.tenantId, measurement.indicatorId, db);
  if (!Number.isFinite(input.newValue)) throw new ObjectiveGateError(["Ingresá el valor con un número"]);

  const status = measurementStatus(indicator, input.newValue);
  const analysis = input.analysis?.trim() || measurement.analysis;
  const issues = [
    ...correctionIssues(input.reason),
    ...(status === "off_target" && !analysis?.trim()
      ? ["El valor está fuera de meta: escribí el análisis del desvío (por qué pasó)"]
      : []),
  ];
  if (issues.length > 0) throw new ObjectiveGateError(issues);

  return db.$transaction(async (tx) => {
    await tx.measurementCorrection.create({
      data: {
        tenantId: input.tenantId,
        measurementId: measurement.id,
        previousValue: measurement.value,
        newValue: input.newValue,
        reason: input.reason.trim(),
        byUserId: input.userId,
      },
    });
    return tx.measurement.update({
      where: { id: measurement.id },
      data: {
        value: input.newValue,
        status: status === "no_data" ? measurement.status : status,
        analysis,
      },
    });
  });
}

// ─── Desvío → Hallazgo ──────────────────────────────────────────────────────

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** Crea un Hallazgo en borrador con el desvío y el análisis; la medición guarda el vínculo. */
export async function createFindingFromMeasurement(
  input: { tenantId: string; measurementId: string; userId: string },
  db: Db = prisma,
) {
  const measurement = await db.measurement.findFirst({
    where: { id: input.measurementId, tenantId: input.tenantId },
    include: { indicator: { include: { objective: { select: { code: true, title: true } } } } },
  });
  if (!measurement) throw new Error("Medición no encontrada");
  if (measurement.status !== "off_target") {
    throw new ObjectiveGateError(["Solo se crea un hallazgo desde un valor fuera de meta"]);
  }
  if (!measurement.analysis?.trim()) {
    throw new ObjectiveGateError(["Escribí primero el análisis del desvío"]);
  }
  if (measurement.findingId) {
    const linked = await db.finding.findFirst({
      where: { id: measurement.findingId, tenantId: input.tenantId },
      select: { status: true },
    });
    if (linked && linked.status !== "cancelled") {
      throw new ObjectiveGateError(["Esta medición ya tiene un hallazgo"]);
    }
  }

  const { indicator } = measurement;
  const period: Period = periodOf(indicator.frequency, measurement.periodStart);
  return db.$transaction(async (tx) => {
    const finding = await tx.finding.create({
      data: {
        tenantId: input.tenantId,
        type: "nonconformity",
        status: "draft",
        title: `Indicador fuera de meta: ${indicator.name} (${period.label})`,
        description: [
          `Valor ${formatNumber(measurement.value)} ${indicator.unit}, meta ${formatNumber(indicator.target)} ${indicator.unit} — ${MEASUREMENT_STATUS_LABELS[measurement.status]}.`,
          `Objetivo ${indicator.objective.code}: ${indicator.objective.title}.`,
          `Análisis del desvío: ${(measurement.analysis ?? "").trim()}`,
        ].join("\n\n"),
        detectedAt: new Date(),
        source: `Indicador ${indicator.name}`,
        createdByUserId: input.userId,
      },
    });
    await tx.measurement.update({ where: { id: measurement.id }, data: { findingId: finding.id } });
    return finding;
  });
}
