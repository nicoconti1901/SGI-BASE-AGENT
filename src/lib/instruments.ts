import { Prisma, type AssetOwnership, type InstrumentControl, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObjectStorage } from "@/lib/storage";
import type { ObjectStorage } from "@/lib/storage/types";
import { InspectionError, closeOpenDueItems, ownerOfPerson, syncOpenDueItem, writeAudit, type Db, type Tx } from "@/lib/inspection-support";
import { cleanName } from "@/domain/masterdata/roster";
import { normalizeAssetCode } from "@/domain/inspections/asset-types/resolve";
import { addDays, addMonths, dateFromIso, diffDays, endOfDayInstant, isIsoDate, isoFromDate, todayIso } from "@/domain/inspections/dates";
import {
  INSTRUMENT_TYPE_KEY,
  STATUS_GROUPS,
  calibrationStatus,
  channelsSchema,
  deriveControl,
  instrumentAttributesSchema,
  instrumentUsability,
  validateControlConfig,
  wasInstrumentValidOn,
  type Channel,
  type ControlConfig,
  type InstrumentStatus,
  type RecordSummary,
  type StatusGroup,
  type StatusOutput,
  type Usability,
} from "@/domain/calibration";

export const INSTRUMENTS_PAGE_SIZE = 25;
export const INSTRUMENTS_EXPORT_LIMIT = 20_000;

// ─── Estado de un equipo ───────────────────────────────────────────────────

export type InstrumentView = {
  status: InstrumentStatus;
  reasons: InstrumentStatus[];
  nextDueAt: string | null;
  usability: Usability;
};

const iso = (d: Date | null): string | null => (d ? isoFromDate(d) : null);

/** Estado y utilizabilidad de un equipo a partir de sus columnas derivadas. Es la versión en memoria de la regla SQL de la lista. */
export function instrumentView(
  control: Pick<
    InstrumentControl,
    | "requiresCalibration"
    | "requiresVerification"
    | "calibrationValidUntil"
    | "verificationValidUntil"
    | "lastDecision"
    | "impactPending"
    | "inCalibrationSince"
    | "expectedReturnAt"
    | "alertLeadDays"
  >,
  assetStatus: "in_service" | "out_of_service" | "retired",
  today: string = todayIso(),
): InstrumentView {
  const s: StatusOutput = calibrationStatus({
    today,
    requirements: { calibration: control.requiresCalibration, verification: control.requiresVerification },
    validity: { calibrationValidUntil: iso(control.calibrationValidUntil), verificationValidUntil: iso(control.verificationValidUntil) },
    hold: { lastDecision: control.lastDecision, impactPending: control.impactPending, inCalibrationSince: iso(control.inCalibrationSince) },
    leadDays: control.alertLeadDays,
  });
  return {
    status: s.status,
    reasons: s.reasons,
    nextDueAt: s.nextDueAt,
    usability: instrumentUsability({ assetStatus, status: s.status, nextDueAt: s.nextDueAt, dueKind: s.dueKind, expectedReturnAt: iso(control.expectedReturnAt) }),
  };
}

export function parseChannels(raw: unknown): Channel[] {
  const parsed = channelsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

// ─── Alta y edición ────────────────────────────────────────────────────────

async function requireSite(db: Db | Tx, tenantId: string, siteId: string) {
  const site = await db.site.findFirst({ where: { id: siteId, tenantId, active: true }, select: { id: true } });
  if (!site) throw new InspectionError("La sede no existe o está dada de baja");
}

async function requirePerson(db: Db | Tx, tenantId: string, personId: string | null | undefined) {
  if (!personId) return;
  const person = await db.person.findFirst({ where: { id: personId, tenantId, status: "active" }, select: { id: true } });
  if (!person) throw new InspectionError("La persona asignada no existe o está dada de baja");
}

function parseAttributes(raw: unknown) {
  const parsed = instrumentAttributesSchema.safeParse(raw ?? {});
  if (!parsed.success) throw new InspectionError(parsed.error.issues.map((i) => i.message).join(" · "), "invalid_attributes", parsed.error.issues);
  return Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== null && v !== undefined)) as Prisma.InputJsonObject;
}

function parseConfig(raw: unknown): ControlConfig {
  const result = validateControlConfig(raw);
  if (!result.ok) throw new InspectionError(result.issues.map((i) => i.message).join(" · "), "invalid_control", result.issues);
  return result.config;
}

function controlData(c: ControlConfig) {
  return {
    magnitude: c.magnitude,
    isReferenceStandard: c.isReferenceStandard,
    criticalUse: c.criticalUse,
    criticalUseReason: c.criticalUse ? c.criticalUseReason : null,
    requiresCalibration: c.requiresCalibration,
    calibrationIntervalMonths: c.requiresCalibration ? (c.calibrationIntervalMonths ?? null) : null,
    requiresVerification: c.requiresVerification,
    verificationIntervalMonths: c.requiresVerification ? (c.verificationIntervalMonths ?? null) : null,
    intervalReason: c.intervalReason,
    noControlReason: c.requiresCalibration || c.requiresVerification ? null : c.noControlReason,
    decisionRule: c.decisionRule,
    decisionRuleReason: c.decisionRule === "guard_band" ? null : c.decisionRuleReason,
    alertLeadDays: c.alertLeadDays,
    channels: c.channels as unknown as Prisma.InputJsonValue,
  };
}

function translateUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new InspectionError("Ya existe un activo con ese código");
  throw error;
}

export type InstrumentInput = {
  tenantId: string;
  actorUserId: string;
  code: string;
  description: string;
  siteId: string;
  sector?: string | null;
  ownership?: AssetOwnership;
  contractorName?: string | null;
  assignedPersonId?: string | null;
  /** Marca, modelo, n.° de serie, puesta en uso. */
  attributes?: unknown;
  /** Configuración metrológica sin validar (se valida acá). */
  control: unknown;
};

function ownershipData(ownership: AssetOwnership | undefined, contractorName: string | null | undefined) {
  const o = ownership ?? "own";
  const name = cleanName(contractorName ?? "") || null;
  if (o === "contractor" && !name) throw new InspectionError("Indicá el nombre del contratista");
  return { ownership: o, contractorName: o === "own" ? null : name };
}

/** Alta de un equipo de medición: el activo y su control metrológico, juntos o ninguno. */
export async function createInstrument(input: InstrumentInput, db: PrismaClient = prisma) {
  const code = normalizeAssetCode(input.code);
  if (!code.ok) throw new InspectionError(code.message);
  const description = cleanName(input.description);
  if (description.length < 2) throw new InspectionError("La descripción debe tener al menos 2 caracteres");
  const attributes = parseAttributes(input.attributes);
  const config = parseConfig(input.control);
  const own = ownershipData(input.ownership, input.contractorName);
  await requireSite(db, input.tenantId, input.siteId);
  await requirePerson(db, input.tenantId, input.assignedPersonId);

  try {
    return await db.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          tenantId: input.tenantId,
          typeKey: INSTRUMENT_TYPE_KEY,
          code: code.code,
          description,
          siteId: input.siteId,
          sector: cleanName(input.sector ?? "") || null,
          ...own,
          assignedPersonId: input.assignedPersonId || null,
          attributes,
          attributesVersion: 1,
          createdByUserId: input.actorUserId,
        },
      });
      await tx.instrumentControl.create({ data: { tenantId: input.tenantId, assetId: asset.id, ...controlData(config) } });
      await tx.assetStatusEvent.create({
        data: { tenantId: input.tenantId, assetId: asset.id, fromStatus: null, toStatus: "in_service", reasonCode: "created", byUserId: input.actorUserId },
      });
      await writeAudit(tx, { tenantId: input.tenantId, entityType: "instrument", entityId: asset.id, action: "create", actorUserId: input.actorUserId, summary: `Alta del equipo de medición ${asset.code}` });
      return asset;
    });
  } catch (error) {
    return translateUnique(error);
  }
}

/**
 * Edita los datos del equipo y su configuración. Cambiar la regla, el EMP o los intervalos no toca los registros
 * cerrados: cada uno guardó la regla y el intervalo con los que se decidió.
 */
export async function updateInstrument(
  input: Omit<InstrumentInput, "code"> & { assetId: string },
  db: PrismaClient = prisma,
) {
  const current = await db.asset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId, typeKey: INSTRUMENT_TYPE_KEY } });
  if (!current) throw new InspectionError("Equipo no encontrado");
  if (current.status === "retired") throw new InspectionError("El equipo está dado de baja: no se puede editar");
  const description = cleanName(input.description);
  if (description.length < 2) throw new InspectionError("La descripción debe tener al menos 2 caracteres");
  const attributes = parseAttributes(input.attributes);
  const config = parseConfig(input.control);
  const own = ownershipData(input.ownership ?? current.ownership, input.contractorName ?? current.contractorName);
  if (input.siteId !== current.siteId) await requireSite(db, input.tenantId, input.siteId);
  const assignedPersonId = input.assignedPersonId || null;
  if (assignedPersonId !== current.assignedPersonId) await requirePerson(db, input.tenantId, assignedPersonId);

  return db.$transaction(async (tx) => {
    const asset = await tx.asset.update({
      where: { id: current.id },
      data: { description, siteId: input.siteId, sector: cleanName(input.sector ?? "") || null, ...own, assignedPersonId, attributes },
    });
    await tx.instrumentControl.update({ where: { assetId: current.id }, data: controlData(config) });
    await recomputeInstrumentControl(input.tenantId, current.id, tx);
    await writeAudit(tx, { tenantId: input.tenantId, entityType: "instrument", entityId: asset.id, action: "update", actorUserId: input.actorUserId, summary: `Edición del equipo de medición ${asset.code}` });
    return asset;
  });
}

// ─── Columnas derivadas ────────────────────────────────────────────────────

/**
 * Reconstruye las columnas derivadas de `InstrumentControl` desde los registros cerrados y no anulados, el envío
 * abierto y las evaluaciones pendientes. Es idempotente: recalcular dos veces deja lo mismo.
 * También deja al día los `DueItem` del equipo (próxima calibración o verificación y evaluaciones pendientes).
 */
export async function recomputeInstrumentControl(tenantId: string, assetId: string, db: Db | Tx = prisma) {
  const control = await db.instrumentControl.findFirst({ where: { tenantId, assetId } });
  if (!control) throw new InspectionError("El equipo no tiene control metrológico");
  const [records, pending, openShipment] = await Promise.all([
    db.calibrationRecord.findMany({
      where: { tenantId, assetId, status: "closed" },
      select: { kind: true, status: true, performedAt: true, closedAt: true, asLeftResult: true, validUntil: true },
    }),
    db.impactAssessment.findMany({ where: { tenantId, assetId, status: "pending" }, select: { id: true, createdAt: true } }),
    db.instrumentShipment.findFirst({ where: { tenantId, assetId, returnedAt: null }, orderBy: { sentAt: "desc" }, select: { sentAt: true, expectedReturnAt: true } }),
  ]);
  const summaries: RecordSummary[] = records.map((r) => ({
    kind: r.kind,
    status: r.status,
    performedAt: isoFromDate(r.performedAt),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    asLeftResult: r.asLeftResult,
    validUntil: iso(r.validUntil),
  }));
  const d = deriveControl({
    requirements: { calibration: control.requiresCalibration, verification: control.requiresVerification },
    records: summaries,
    pendingAssessments: pending.length,
    openShipment: openShipment ? { sentAt: isoFromDate(openShipment.sentAt), expectedReturnAt: iso(openShipment.expectedReturnAt) } : null,
  });
  const toDate = (v: string | null) => (v ? dateFromIso(v) : null);
  const updated = await db.instrumentControl.update({
    where: { assetId },
    data: {
      calibrationValidUntil: toDate(d.calibrationValidUntil),
      verificationValidUntil: toDate(d.verificationValidUntil),
      nextDueAt: toDate(d.nextDueAt),
      lastDecision: d.lastDecision,
      impactPending: d.impactPending,
      inCalibrationSince: toDate(d.inCalibrationSince),
      expectedReturnAt: toDate(d.expectedReturnAt),
    },
  });
  await syncInstrumentDueItems(db, { tenantId, assetId, control: updated, pending });
  return updated;
}

/** Días corridos que se le dan a una evaluación de impacto abierta (fijo en el código, no por empresa). */
export const IMPACT_ASSESSMENT_DUE_DAYS = 10;

/**
 * Deja exactamente un vencimiento abierto por equipo y tipo (calibración, verificación) y por evaluación pendiente.
 * Es idempotente: recalcular dos veces no duplica. Un equipo dado de baja o con último resultado «no apto» deja de
 * vencer (ya está en rojo y pide una calibración nueva); la evaluación de impacto sigue vigente aunque se dé de baja.
 */
async function syncInstrumentDueItems(
  db: Db | Tx,
  input: { tenantId: string; assetId: string; control: InstrumentControl; pending: { id: string; createdAt: Date }[] },
) {
  const { tenantId, assetId, control } = input;
  const asset = await db.asset.findFirst({ where: { id: assetId, tenantId }, select: { code: true, description: true, siteId: true, assignedPersonId: true, status: true } });
  if (!asset) return;
  const owner = await ownerOfPerson(db, tenantId, asset.assignedPersonId);
  const active = asset.status !== "retired" && control.lastDecision !== "not_apt";
  const kinds = [
    { entityType: "instrument_calibration", required: control.requiresCalibration, until: control.calibrationValidUntil, label: "Calibración" },
    { entityType: "instrument_verification", required: control.requiresVerification, until: control.verificationValidUntil, label: "Verificación" },
  ] as const;
  for (const kind of kinds) {
    if (active && kind.required && kind.until) {
      await syncOpenDueItem(db, {
        tenantId,
        entityType: kind.entityType,
        entityId: assetId,
        title: `${kind.label} de ${asset.code} — ${asset.description}`,
        dueAt: endOfDayInstant(isoFromDate(kind.until)),
        leadDays: control.alertLeadDays,
        ownerUserId: owner,
        siteId: asset.siteId,
        personId: asset.assignedPersonId,
      });
    } else {
      await closeOpenDueItems(db, tenantId, kind.entityType, [assetId]);
    }
  }
  for (const assessment of input.pending) {
    await syncOpenDueItem(db, {
      tenantId,
      entityType: "instrument_impact",
      entityId: assessment.id,
      title: `Evaluación de impacto de ${asset.code} — ${asset.description}`,
      dueAt: endOfDayInstant(addDays(todayIso(assessment.createdAt), IMPACT_ASSESSMENT_DUE_DAYS)),
      leadDays: 3,
      ownerUserId: owner,
      siteId: asset.siteId,
      personId: asset.assignedPersonId,
    });
  }
  const finished = await db.impactAssessment.findMany({ where: { tenantId, assetId, status: "completed" }, select: { id: true } });
  await closeOpenDueItems(db, tenantId, "instrument_impact", finished.map((a) => a.id));
}

// ─── Lista, contadores y exportación ───────────────────────────────────────

export type InstrumentFilter = {
  q?: string;
  siteId?: string;
  magnitude?: string;
  /** Grupo de estados (los contadores clicables). */
  group?: StatusGroup;
  /** Página, desde 1. */
  page?: number;
};

/** Estado derivado, en SQL: la misma precedencia que `calibrationStatus`. */
const STATUS_SQL = (today: string) => Prisma.sql`CASE
  WHEN NOT (c."requiresCalibration" OR c."requiresVerification") THEN 'not_required'
  WHEN c."inCalibrationSince" IS NOT NULL THEN 'in_calibration'
  WHEN c."lastDecision" = 'not_apt' THEN 'not_apt'
  WHEN c."impactPending" THEN 'impact_pending'
  WHEN (c."requiresCalibration" AND c."calibrationValidUntil" IS NULL) OR (c."requiresVerification" AND c."verificationValidUntil" IS NULL) THEN 'never_calibrated'
  WHEN c."nextDueAt" < ${today}::date THEN 'expired'
  WHEN c."nextDueAt" - c."alertLeadDays" <= ${today}::date THEN 'due_soon'
  ELSE 'valid'
END`;

const RANK_SQL = Prisma.sql`CASE b.st
  WHEN 'not_apt' THEN 0 WHEN 'expired' THEN 1 WHEN 'impact_pending' THEN 2 WHEN 'never_calibrated' THEN 3
  WHEN 'in_calibration' THEN 4 WHEN 'due_soon' THEN 5 WHEN 'valid' THEN 6 ELSE 7 END`;

/** Equipos del alcance elegido (sin los dados de baja), con su estado calculado en la base. */
function baseQuery(tenantId: string, filter: InstrumentFilter, today: string) {
  const q = filter.q?.trim();
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;
  return Prisma.sql`
    SELECT a.id, a.code, a.status AS "assetStatus", c."nextDueAt", ${STATUS_SQL(today)} AS st
    FROM "instrument_control" c
    JOIN "asset" a ON a.id = c."assetId" AND a."tenantId" = c."tenantId"
    WHERE c."tenantId" = ${tenantId}
      AND a."typeKey" = ${INSTRUMENT_TYPE_KEY}
      AND a.status <> 'retired'
      ${filter.siteId ? Prisma.sql`AND a."siteId" = ${filter.siteId}` : Prisma.empty}
      ${filter.magnitude ? Prisma.sql`AND c.magnitude = ${filter.magnitude}` : Prisma.empty}
      ${like ? Prisma.sql`AND (a.code ILIKE ${like} OR a.description ILIKE ${like})` : Prisma.empty}`;
}

export type InstrumentCounters = Record<StatusGroup, number> & { total: number };

/** Conteos por estado con una sola consulta agregada en la base. */
export async function instrumentCounters(tenantId: string, filter: InstrumentFilter = {}, db: Db = prisma, today: string = todayIso()): Promise<InstrumentCounters> {
  const rows = await db.$queryRaw<{ st: InstrumentStatus; n: bigint }[]>`
    SELECT b.st, count(*) AS n FROM (${baseQuery(tenantId, filter, today)}) b GROUP BY b.st`;
  const byStatus = new Map(rows.map((r) => [r.st, Number(r.n)]));
  const out = { total: 0 } as InstrumentCounters;
  for (const group of Object.keys(STATUS_GROUPS) as StatusGroup[]) {
    out[group] = STATUS_GROUPS[group].reduce((sum, st) => sum + (byStatus.get(st) ?? 0), 0);
  }
  out.total = [...byStatus.values()].reduce((a, b) => a + b, 0);
  return out;
}

export type PlanCompliance = {
  /** Equipos con control metrológico (sin los dados de baja ni los «sin control»). */
  controlled: number;
  /** De esos, los que se pueden usar hoy. */
  usable: number;
  /** Calibraciones aptas de los últimos 12 meses que tenían una anterior: cuántas se hicieron antes de que venciera. */
  onTime: number;
  renewals: number;
};

/**
 * Cumplimiento del plan, con dos consultas agregadas (sin cargar equipos): cuántos equipos con control se pueden usar
 * hoy, y qué parte de las recalibraciones de los últimos 12 meses se hizo antes del vencimiento de la anterior.
 */
export async function planCompliance(tenantId: string, filter: InstrumentFilter = {}, db: Db = prisma, today: string = todayIso()): Promise<PlanCompliance> {
  const since = addMonths(today, -12);
  const [status, renewals] = await Promise.all([
    db.$queryRaw<{ controlled: bigint; usable: bigint }[]>`
      SELECT count(*) FILTER (WHERE b.st <> 'not_required') AS controlled,
             count(*) FILTER (WHERE b.st IN ('valid', 'due_soon') AND b."assetStatus" = 'in_service') AS usable
      FROM (${baseQuery(tenantId, filter, today)}) b`,
    db.$queryRaw<{ on_time: bigint; total: bigint }[]>`
      WITH recs AS (
        SELECT r."performedAt",
               LAG(r."validUntil") OVER (PARTITION BY r."assetId" ORDER BY r."performedAt", r."closedAt") AS prev_until
        FROM "calibration_record" r
        JOIN "asset" a ON a.id = r."assetId" AND a."tenantId" = r."tenantId"
        WHERE r."tenantId" = ${tenantId} AND r.kind = 'calibration' AND r.status = 'closed' AND r."asLeftResult" = 'apt'
          AND a.status <> 'retired' AND a."typeKey" = ${INSTRUMENT_TYPE_KEY}
          ${filter.siteId ? Prisma.sql`AND a."siteId" = ${filter.siteId}` : Prisma.empty}
      )
      SELECT count(*) FILTER (WHERE prev_until IS NOT NULL AND "performedAt" <= prev_until) AS on_time,
             count(*) FILTER (WHERE prev_until IS NOT NULL) AS total
      FROM recs WHERE "performedAt" >= ${since}::date`,
  ]);
  return {
    controlled: Number(status[0]?.controlled ?? 0),
    usable: Number(status[0]?.usable ?? 0),
    onTime: Number(renewals[0]?.on_time ?? 0),
    renewals: Number(renewals[0]?.total ?? 0),
  };
}

export type UpcomingDue = { assetId: string; code: string; description: string; siteName: string; nextDueAt: string; daysLeft: number };

/** Equipos que vencen en los próximos `days` días, el más próximo primero (los ya vencidos están en «No usar»). */
export async function upcomingInstrumentDues(
  tenantId: string,
  opts: { days?: number; limit?: number; siteId?: string } = {},
  db: Db = prisma,
  today: string = todayIso(),
): Promise<{ items: UpcomingDue[]; total: number }> {
  const days = opts.days ?? 30;
  const limit = opts.limit ?? 8;
  const rows = await db.$queryRaw<{ id: string; code: string; description: string; site: string; nextDueAt: Date; total: bigint }[]>`
    SELECT a.id, a.code, a.description, s.name AS site, c."nextDueAt", count(*) OVER () AS total
    FROM "instrument_control" c
    JOIN "asset" a ON a.id = c."assetId" AND a."tenantId" = c."tenantId"
    JOIN "site" s ON s.id = a."siteId"
    WHERE c."tenantId" = ${tenantId} AND a."typeKey" = ${INSTRUMENT_TYPE_KEY} AND a.status <> 'retired'
      AND c."nextDueAt" >= ${today}::date AND c."nextDueAt" <= ${addDays(today, days)}::date
      ${opts.siteId ? Prisma.sql`AND a."siteId" = ${opts.siteId}` : Prisma.empty}
    ORDER BY c."nextDueAt" ASC, a.code ASC
    LIMIT ${limit}`;
  return {
    total: rows[0] ? Number(rows[0].total) : 0,
    items: rows.map((r) => ({ assetId: r.id, code: r.code, description: r.description, siteName: r.site, nextDueAt: isoFromDate(r.nextDueAt), daysLeft: diffDays(today, isoFromDate(r.nextDueAt)) })),
  };
}

const listInclude = {
  asset: {
    select: {
      id: true,
      code: true,
      description: true,
      status: true,
      sector: true,
      attributes: true,
      site: { select: { name: true } },
      assignedPerson: { select: { name: true } },
    },
  },
} satisfies Prisma.InstrumentControlInclude;

/**
 * Página de la lista: primero lo que hay que atender (no apto, vencido…), después por vencimiento más próximo.
 * El filtro, el orden y el total salen de una consulta en la base; después se leen solo las 25 filas de la página.
 */
export async function listInstruments(tenantId: string, filter: InstrumentFilter = {}, db: Db = prisma, today: string = todayIso()) {
  const page = Math.max(1, Math.floor(filter.page ?? 1));
  const statuses = filter.group ? STATUS_GROUPS[filter.group] : null;
  const rows = await db.$queryRaw<{ id: string; total: bigint }[]>`
    SELECT b.id, count(*) OVER () AS total
    FROM (${baseQuery(tenantId, filter, today)}) b
    ${statuses ? Prisma.sql`WHERE b.st IN (${Prisma.join([...statuses])})` : Prisma.empty}
    ORDER BY ${RANK_SQL}, b."nextDueAt" ASC NULLS LAST, b.code ASC
    LIMIT ${INSTRUMENTS_PAGE_SIZE} OFFSET ${(page - 1) * INSTRUMENTS_PAGE_SIZE}`;
  const total = rows[0] ? Number(rows[0].total) : 0;
  const controls = rows.length
    ? await db.instrumentControl.findMany({ where: { tenantId, assetId: { in: rows.map((r) => r.id) } }, include: listInclude })
    : [];
  const byId = new Map(controls.map((c) => [c.assetId, c]));
  const items = rows.flatMap((r) => {
    const c = byId.get(r.id);
    return c ? [{ ...c, view: instrumentView(c, c.asset.status, today) }] : [];
  });
  return { items, total, page, pageSize: INSTRUMENTS_PAGE_SIZE, pages: Math.max(1, Math.ceil(total / INSTRUMENTS_PAGE_SIZE)) };
}

export type InstrumentExportRow = {
  code: string;
  description: string;
  magnitude: string;
  site: string;
  responsible: string | null;
  status: InstrumentStatus;
  usable: boolean;
  reason: string | null;
  nextDueAt: string | null;
};

/** Mismas filas que la lista, sin paginar, hasta el tope. */
export async function exportInstrumentRows(tenantId: string, filter: InstrumentFilter = {}, db: Db = prisma, today: string = todayIso()) {
  const statuses = filter.group ? STATUS_GROUPS[filter.group] : null;
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT b.id FROM (${baseQuery(tenantId, filter, today)}) b
    ${statuses ? Prisma.sql`WHERE b.st IN (${Prisma.join([...statuses])})` : Prisma.empty}
    ORDER BY ${RANK_SQL}, b."nextDueAt" ASC NULLS LAST, b.code ASC
    LIMIT ${INSTRUMENTS_EXPORT_LIMIT + 1}`;
  const truncated = rows.length > INSTRUMENTS_EXPORT_LIMIT;
  const ids = rows.slice(0, INSTRUMENTS_EXPORT_LIMIT).map((r) => r.id);
  const controls = ids.length ? await db.instrumentControl.findMany({ where: { tenantId, assetId: { in: ids } }, include: listInclude }) : [];
  const byId = new Map(controls.map((c) => [c.assetId, c]));
  const out: InstrumentExportRow[] = ids.flatMap((id) => {
    const c = byId.get(id);
    if (!c) return [];
    const view = instrumentView(c, c.asset.status, today);
    return [
      {
        code: c.asset.code,
        description: c.asset.description,
        magnitude: c.magnitude,
        site: c.asset.site.name,
        responsible: c.asset.assignedPerson?.name ?? null,
        status: view.status,
        usable: view.usability.usable,
        reason: view.usability.reason,
        nextDueAt: view.nextDueAt,
      },
    ];
  });
  return { rows: out, truncated };
}

// ─── Ficha ─────────────────────────────────────────────────────────────────

export const HISTORY_PAGE_SIZE = 20;

export async function getInstrument(tenantId: string, assetId: string, opts: { historyPage?: number } = {}, db: Db = prisma, today: string = todayIso()) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, tenantId, typeKey: INSTRUMENT_TYPE_KEY },
    include: {
      site: { select: { id: true, name: true } },
      assignedPerson: { select: { id: true, name: true, employeeCode: true, site: { select: { name: true } } } },
      instrControl: true,
    },
  });
  if (!asset || !asset.instrControl) return null;
  const control = asset.instrControl;
  const page = Math.max(1, Math.floor(opts.historyPage ?? 1));
  const [records, recordCount, openShipment, pendingAssessment] = await Promise.all([
    db.calibrationRecord.findMany({
      where: { tenantId, assetId },
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      include: {
        attachments: { select: { id: true, fileName: true, contentType: true, sizeBytes: true }, orderBy: { createdAt: "asc" } },
        referenceStandard: { select: { id: true, code: true } },
        _count: { select: { points: true } },
      },
    }),
    db.calibrationRecord.count({ where: { tenantId, assetId } }),
    db.instrumentShipment.findFirst({ where: { tenantId, assetId, returnedAt: null }, orderBy: { sentAt: "desc" } }),
    db.impactAssessment.findFirst({
      where: { tenantId, assetId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: { triggerRecord: { select: { id: true, performedAt: true, kind: true } } },
    }),
  ]);
  const loaderIds = [...new Set(records.map((r) => r.loadedByUserId))];
  const users = loaderIds.length ? await db.user.findMany({ where: { id: { in: loaderIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  const { instrControl: _control, ...assetRest } = asset;
  void _control;
  return {
    asset: assetRest,
    control,
    channels: parseChannels(control.channels),
    view: instrumentView(control, asset.status, today),
    records: records.map((r) => ({ ...r, loadedByName: names.get(r.loadedByUserId) ?? "Usuario" })),
    recordCount,
    historyPage: page,
    historyPages: Math.max(1, Math.ceil(recordCount / HISTORY_PAGE_SIZE)),
    openShipment,
    pendingAssessment,
  };
}

// ─── Uso desde otros módulos ───────────────────────────────────────────────

/** Búsqueda para el selector de equipos: devuelve todos (los no utilizables también, con el motivo). */
export async function searchInstruments(
  tenantId: string,
  opts: { q?: string; siteId?: string; magnitude?: string; take?: number },
  db: Db = prisma,
  today: string = todayIso(),
) {
  const q = opts.q?.trim();
  const rows = await db.instrumentControl.findMany({
    where: {
      tenantId,
      ...(opts.magnitude ? { magnitude: opts.magnitude } : {}),
      asset: {
        status: { not: "retired" },
        ...(opts.siteId ? { siteId: opts.siteId } : {}),
        ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
      },
    },
    include: { asset: { select: { id: true, code: true, description: true, status: true, site: { select: { name: true } } } } },
    orderBy: { asset: { code: "asc" } },
    take: Math.min(opts.take ?? 30, 100),
  });
  return rows.map((c) => ({
    id: c.asset.id,
    code: c.asset.code,
    description: c.asset.description,
    magnitude: c.magnitude,
    siteName: c.asset.site.name,
    usability: instrumentView(c, c.asset.status, today).usability,
  }));
}

/**
 * Chequeo del servidor para los módulos que usan un equipo (inspección de espacio confinado, auditoría de seguridad):
 * el bloqueo no depende de la pantalla. Con una fecha pasada pregunta si el equipo estaba vigente ese día.
 */
export async function checkInstrumentForUse(
  tenantId: string,
  assetId: string,
  opts: { onDate?: string } = {},
  db: Db = prisma,
  today: string = todayIso(),
): Promise<Usability> {
  const control = await db.instrumentControl.findFirst({ where: { tenantId, assetId }, include: { asset: { select: { status: true, code: true } } } });
  if (!control) return { usable: false, reason: "El equipo no existe o no es un equipo de medición", action: null };
  const onDate = opts.onDate && isIsoDate(opts.onDate) ? opts.onDate : today;
  if (onDate >= today) return instrumentView(control, control.asset.status, today).usability;
  if (!control.requiresCalibration && !control.requiresVerification) return { usable: true, reason: null, action: null };
  const records = await db.calibrationRecord.findMany({
    where: { tenantId, assetId, status: "closed", performedAt: { lte: dateFromIso(onDate) } },
    select: { kind: true, status: true, performedAt: true, closedAt: true, asLeftResult: true, validUntil: true },
  });
  const valid = wasInstrumentValidOn(
    records.map((r) => ({ kind: r.kind, status: r.status, performedAt: isoFromDate(r.performedAt), closedAt: r.closedAt?.toISOString() ?? null, asLeftResult: r.asLeftResult, validUntil: iso(r.validUntil) })),
    onDate,
  );
  return valid
    ? { usable: true, reason: null, action: null }
    : { usable: false, reason: `El equipo no tenía una calibración vigente al ${onDate.split("-").reverse().join("/")}`, action: null };
}

/**
 * Lo que llama el servidor de un módulo que usa un equipo, antes de guardar: si no se puede usar, corta con el
 * motivo. Con `onDate` en el pasado, exige que haya estado vigente ese día.
 */
export async function requireUsableInstrument(
  tenantId: string,
  assetId: string,
  opts: { onDate?: string } = {},
  db: Db = prisma,
  today: string = todayIso(),
): Promise<void> {
  const usability = await checkInstrumentForUse(tenantId, assetId, opts, db, today);
  if (!usability.usable) throw new InspectionError(`No se puede usar el equipo: ${usability.reason ?? "no disponible"}`, "instrument_unusable");
}

// ─── Certificados ──────────────────────────────────────────────────────────

export async function readCalibrationAttachment(attachmentId: string, options?: { db?: Db; storage?: ObjectStorage }) {
  const db = options?.db ?? prisma;
  const attachment = await db.calibrationAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return null;
  const object = await (options?.storage ?? getObjectStorage()).getObject(attachment.storageKey);
  if (!object) return null;
  return { attachment, body: object.body, contentType: object.contentType };
}
