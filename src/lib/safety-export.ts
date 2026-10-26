/**
 * Exportación y resumen de accidentabilidad (SPEC-accident-stats.md, slice 17.5). Todo se agrega en la base
 * (`groupBy`) y siempre filtra por `tenantId`. Los totales no llevan nombres; el CSV de casos sí, así que solo
 * lo recibe quien puede ver las fichas de salud (nunca el personal de plataforma) y deja registro (quién, cuándo).
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSafetyDashboard, type DashboardFilter, type SafetyDashboard } from "@/lib/safety-dashboard";
import { aggregateIncidentEvents, getSafetySettings, listExposurePeriods, SafetyStatsError, type SafetyUser } from "@/lib/safety-stats";
import { canViewHealthData } from "@/domain/safety-stats/access";
import { buildAggregateRows, type AggregateExportRow, type CaseCsvRow } from "@/domain/safety-stats/export";
import { resolveWindow, segmentsFor } from "@/domain/safety-stats/dashboard";
import { aggregateWindow, type WindowResult } from "@/domain/safety-stats/indices";
import type { MonthKey, SafetySettings } from "@/domain/safety-stats/types";

type Db = PrismaClient;

/** Tope de sedes y de filas de casos de una exportación (una empresa más grande exporta por sede o por período). */
const SITE_LIMIT = 200;
export const CASES_EXPORT_LIMIT = 20_000;

const monthStart = (m: MonthKey) => new Date(`${m}-01T00:00:00.000Z`);

type Scope = { tenantId: string; months: MonthKey[]; siteId?: string };

async function loadSites(scope: Scope, db: Db) {
  return db.site.findMany({
    where: { tenantId: scope.tenantId, ...(scope.siteId ? { id: scope.siteId } : {}) },
    orderBy: { name: "asc" },
    take: SITE_LIMIT,
    select: { id: true, name: true, active: true },
  });
}

/**
 * Numeradores, denominadores y estado por sede, mes y grupo. Las sedes dadas de baja solo salen si tienen horas
 * o accidentes en el período (el historial queda).
 */
export async function getAggregateExport(scope: Scope, db: Db = prisma): Promise<{ rows: AggregateExportRow[]; settings: SafetySettings }> {
  const settings = await getSafetySettings(scope.tenantId, db);
  const allSites = await loadSites(scope, db);
  const range = { tenantId: scope.tenantId, fromMonth: scope.months[0], toMonth: scope.months[scope.months.length - 1], siteIds: allSites.map((s) => s.id) };
  const [exposure, aggregates] = await Promise.all([listExposurePeriods(range, db), aggregateIncidentEvents(range, db)]);
  const withData = new Set([...exposure.map((e) => e.siteId), ...aggregates.events.map((e) => e.siteId)]);
  const sites = allSites.filter((s) => s.active || withData.has(s.id));
  return { rows: buildAggregateRows({ sites, months: scope.months, exposure, events: aggregates.events, openCases: aggregates.openCases, settings }), settings };
}

/**
 * Casos con la persona afectada y la lesión (para quien puede ver las fichas de salud). Excluye los Hallazgos
 * anulados (D4) y deja un registro de la exportación.
 */
export async function exportIncidentCases(
  input: Scope & { actor: SafetyUser },
  db: Db = prisma,
): Promise<{ rows: CaseCsvRow[]; truncated: boolean }> {
  if (!canViewHealthData(input.actor)) throw new SafetyStatsError("Sin permiso para exportar casos con nombres");
  const found = await db.incidentRecord.findMany({
    where: {
      tenantId: input.tenantId,
      periodMonth: { gte: monthStart(input.months[0]), lte: monthStart(input.months[input.months.length - 1]) },
      finding: { status: { not: "cancelled" } },
      ...(input.siteId ? { siteId: input.siteId } : {}),
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    take: CASES_EXPORT_LIMIT + 1,
    select: {
      occurredAt: true,
      employerKind: true,
      classification: true,
      inItinere: true,
      accidentForm: true,
      materialAgent: true,
      lostDays: true,
      returnToWorkDate: true,
      site: { select: { name: true } },
      finding: { select: { title: true, status: true } },
      health: {
        select: { natureOfInjury: true, bodyPart: true, artClaimNumber: true, affectedPerson: { select: { name: true, employeeCode: true } } },
      },
    },
  });
  const truncated = found.length > CASES_EXPORT_LIMIT;
  const rows = found.slice(0, CASES_EXPORT_LIMIT).map(
    (r): CaseCsvRow => ({
      occurredAt: r.occurredAt,
      site: r.site.name,
      employerKind: r.employerKind === "contractor" ? "contractor" : "own",
      classification: r.classification,
      inItinere: r.inItinere,
      accidentForm: r.accidentForm,
      materialAgent: r.materialAgent,
      person: r.health?.affectedPerson?.name ?? null,
      employeeCode: r.health?.affectedPerson?.employeeCode ?? null,
      natureOfInjury: r.health?.natureOfInjury ?? null,
      bodyPart: r.health?.bodyPart ?? null,
      lostDays: r.lostDays,
      returnToWorkDate: r.returnToWorkDate ? r.returnToWorkDate.toISOString().slice(0, 10) : null,
      artClaimNumber: r.health?.artClaimNumber ?? null,
      findingStatus: r.finding.status,
      findingTitle: r.finding.title,
    }),
  );
  await db.masterDataAudit.create({
    data: {
      tenantId: input.tenantId,
      entityType: "incident",
      entityId: input.tenantId,
      action: "export",
      actorUserId: input.actor.userId,
      // Nunca nombres ni lesiones: el registro dice qué se exportó, no qué contiene.
      summary: `Exportación de casos con nombres (${rows.length} caso(s), ${input.months[0]} a ${input.months[input.months.length - 1]})`,
    },
  });
  return { rows, truncated };
}

export type SiteSummary = { siteId: string; siteName: string; result: WindowResult };

export type SafetySummary = SafetyDashboard & { perSite: SiteSummary[] };

/** El tablero del período más el resultado de cada sede, para el resumen de la revisión por la dirección (ISO 45001 §9.3). */
export async function getSafetySummary(tenantId: string, filter: DashboardFilter, db: Db = prisma): Promise<SafetySummary> {
  const dash = await getSafetyDashboard(tenantId, filter, db);
  const months = dash.window.months;
  const range = { tenantId, fromMonth: months[0], toMonth: months[months.length - 1], siteIds: dash.sites.map((s) => s.id) };
  const [exposure, aggregates] = await Promise.all([listExposurePeriods(range, db), aggregateIncidentEvents(range, db)]);
  const settings = { fatalChargeDays: dash.settings.fatalChargeDays, severityBase: dash.settings.severityBase };
  const perSite = dash.sites.map((s) => ({
    siteId: s.id,
    siteName: s.name,
    result: aggregateWindow({ exposure, events: aggregates.events, openCases: aggregates.openCases, months, segments: segmentsFor([s], filter.group), settings }),
  }));
  return { ...dash, perSite };
}

/** Meses de la ventana elegida (mismo criterio que el tablero), para que el archivo coincida con lo que se ve. */
export const windowMonths = (kind: DashboardFilter["kind"], anchor: MonthKey): MonthKey[] => resolveWindow(kind, anchor).months;
