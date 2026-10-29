/**
 * Seguridad vial (Task 18, SPEC-road-safety.md): registro del evento vial, km por vehículo y mes, reinicios
 * de odómetro y avisos mensuales. Todo lleva `tenantId`; los permisos se verifican acá, no solo en la UI.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { closeDueItemsForEntity, createDueItem } from "@/lib/automation";
import { reminderStartsAt } from "@/domain/automation/due";
import { canManageRoadSafety, canReportRoadEvent, type RoadActor } from "@/domain/road-safety/access";
import { isKmMonthClosed, kmDueDay, KM_LEAD_DAYS, lastClosedMonth } from "@/domain/road-safety/due";
import { computeVehicleMonthKm, type OdometerReading, type OdometerReset, type VehicleMonthKm } from "@/domain/road-safety/km";
import { classifyVehicleMonth, type VehicleMonthState } from "@/domain/road-safety/rates";
import {
  DEFAULT_ROAD_SAFETY_SETTINGS,
  type RoadSafetySettings,
} from "@/domain/road-safety/types";
import { validateRoadEvent, type RoadEventInput, type RoadFieldErrors } from "@/domain/road-safety/validation";
import { HEAVY_EQUIPMENT_KEY } from "@/domain/inspections/asset-types/heavy-equipment";
import { LIGHT_VEHICLE_KEY } from "@/domain/inspections/asset-types/light-vehicle";
import { monthLabel } from "@/domain/safety-stats/exposure-import";
import { isIsoDay, localDay } from "@/domain/safety-stats/period";
import type { IncidentClassification, IsoDay, MonthKey } from "@/domain/safety-stats/types";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export type RoadUser = RoadActor & { userId: string };

/** Error de negocio con un mensaje listo para mostrar en la UI. */
export class RoadSafetyError extends Error {
  readonly fieldErrors: RoadFieldErrors;
  constructor(message: string, fieldErrors: RoadFieldErrors = {}) {
    super(message);
    this.name = "RoadSafetyError";
    this.fieldErrors = fieldErrors;
  }
}

/** Vehículos de la flota que llevan km (D12): los livianos. Los pesados se eligen en el evento pero no entran en la grilla. */
export const FLEET_KM_TYPE_KEYS = [LIGHT_VEHICLE_KEY];
export const EVENT_VEHICLE_TYPE_KEYS = [LIGHT_VEHICLE_KEY, HEAVY_EQUIPMENT_KEY];

export const KM_DUE_ENTITY_TYPE = "road_km_period";
const MIN_REASON = 5;

const monthDate = (month: MonthKey) => new Date(`${month}-01T00:00:00.000Z`);
const dayDate = (day: IsoDay) => new Date(`${day}T00:00:00.000Z`);
const nextMonthStart = (month: MonthKey) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1));
};

async function audit(
  db: Db | Tx,
  input: { tenantId: string; entityType: string; entityId: string; action: "create" | "update" | "view"; actorUserId: string; summary: string },
) {
  await db.masterDataAudit.create({ data: input });
}

function requireManager(actor: RoadUser) {
  if (!canManageRoadSafety(actor)) throw new RoadSafetyError("Tu rol no permite gestionar la seguridad vial");
}

function checkReason(reason: string | null | undefined): string {
  const text = (reason ?? "").trim();
  if (text.length < MIN_REASON) throw new RoadSafetyError(`Contá el motivo (al menos ${MIN_REASON} caracteres)`, { reason: "Contá el motivo" });
  return text;
}

// ─── Ajustes ────────────────────────────────────────────────────────────────

export async function getRoadSafetySettings(tenantId: string, db: Db = prisma): Promise<RoadSafetySettings> {
  const row = await db.roadSafetySettings.findUnique({ where: { tenantId } });
  return row
    ? {
        minExposureKm: row.minExposureKm,
        repeatThreshold: row.repeatThreshold,
        repeatWindowMonths: row.repeatWindowMonths,
        speedingPerDriver: row.speedingPerDriver,
      }
    : DEFAULT_ROAD_SAFETY_SETTINGS;
}

export async function updateRoadSafetySettings(
  input: { tenantId: string; actor: RoadUser; settings: RoadSafetySettings },
  db: Db = prisma,
): Promise<RoadSafetySettings> {
  requireManager(input.actor);
  const s = input.settings;
  if (!Number.isInteger(s.minExposureKm) || s.minExposureKm < 0) throw new RoadSafetyError("La exposición mínima es un número de km, 0 o más");
  if (!Number.isInteger(s.repeatThreshold) || s.repeatThreshold < 1) throw new RoadSafetyError("La reincidencia empieza en 1 evento o más");
  if (!Number.isInteger(s.repeatWindowMonths) || s.repeatWindowMonths < 1 || s.repeatWindowMonths > 60) {
    throw new RoadSafetyError("La ventana de reincidencia va de 1 a 60 meses");
  }
  await db.$transaction(async (tx) => {
    await tx.roadSafetySettings.upsert({
      where: { tenantId: input.tenantId },
      create: { tenantId: input.tenantId, ...s },
      update: s,
    });
    await audit(tx, {
      tenantId: input.tenantId,
      entityType: "road_settings",
      entityId: input.tenantId,
      action: "update",
      actorUserId: input.actor.userId,
      summary: "Cambio de ajustes de seguridad vial",
    });
  });
  return s;
}

// ─── Flota ──────────────────────────────────────────────────────────────────

export type FleetVehicle = { id: string; code: string; description: string };

/** Vehículos que se pueden elegir en un evento (livianos y pesados no dados de baja). */
export async function listEventVehicles(tenantId: string, db: Db = prisma): Promise<FleetVehicle[]> {
  return db.asset.findMany({
    where: { tenantId, typeKey: { in: EVENT_VEHICLE_TYPE_KEYS }, status: { not: "retired" } },
    select: { id: true, code: true, description: true },
    orderBy: { code: "asc" },
    take: 500,
  });
}

// ─── Detalle vial del evento ────────────────────────────────────────────────

export type RoadEventDetailInput = Omit<RoadEventInput, "classification"> & {
  vehicleLabel: string | null;
  driverPersonId: string | null;
};

function fail(errors: RoadFieldErrors): never {
  const [message] = Object.values(errors);
  throw new RoadSafetyError(message, errors);
}

/** Valida el detalle y comprueba que el vehículo y el conductor sean de la empresa. Devuelve los datos limpios. */
export async function prepareRoadDetail(
  db: Db | Tx,
  tenantId: string,
  classification: IncidentClassification,
  detail: RoadEventDetailInput,
) {
  const errors = validateRoadEvent({ ...detail, classification });
  if (Object.keys(errors).length > 0) fail(errors);

  const usesAsset = detail.vehicleKind === "own" || detail.vehicleKind === "contractor";
  const assetId = usesAsset ? detail.assetId : null;
  if (assetId) {
    const asset = await db.asset.findFirst({ where: { id: assetId, tenantId, typeKey: { in: EVENT_VEHICLE_TYPE_KEYS } }, select: { id: true } });
    if (!asset) fail({ assetId: "Elegí un vehículo de la empresa" });
  }
  if (detail.driverPersonId) {
    const person = await db.person.findFirst({ where: { id: detail.driverPersonId, tenantId }, select: { id: true } });
    if (!person) fail({ driverPersonId: "Elegí a una persona de la empresa" });
  }
  return {
    vehicleKind: detail.vehicleKind,
    assetId,
    vehicleLabel: detail.vehicleLabel?.trim() || null,
    driverPersonId: detail.driverPersonId,
    eventType: detail.eventType,
    roadSurface: detail.roadSurface,
    light: detail.light,
    weather: detail.weather,
    seatbelt: detail.seatbelt,
    estimatedSpeedKmh: detail.estimatedSpeedKmh,
    propertyDamage: detail.propertyDamage,
    injuredCount: detail.injuredCount,
    hospitalizedCount: detail.hospitalizedCount,
    fatalCount: detail.fatalCount,
    mainCause: detail.mainCause,
    reportFiled: detail.reportFiled,
    reportRef: detail.reportFiled ? detail.reportRef?.trim() || null : null,
  };
}

export type PreparedRoadDetail = Awaited<ReturnType<typeof prepareRoadDetail>>;

/** Inserta el detalle dentro de la transacción del alta del incidente (la ficha ya existe). */
export async function insertRoadDetail(tx: Tx, input: { tenantId: string; incidentRecordId: string; actorUserId: string; data: PreparedRoadDetail }) {
  const created = await tx.roadEventDetail.create({
    data: { tenantId: input.tenantId, incidentRecordId: input.incidentRecordId, createdByUserId: input.actorUserId, ...input.data },
  });
  await audit(tx, {
    tenantId: input.tenantId,
    entityType: "road_event",
    entityId: input.incidentRecordId,
    action: "create",
    actorUserId: input.actorUserId,
    // Nunca conductor ni lesionados: el registro dice qué se hizo, no qué contiene.
    summary: "Alta del detalle vial del evento",
  });
  return created;
}

/**
 * Crea o corrige el detalle vial de una ficha de accidente. Cualquier colaborador lo da de alta; corregirlo es
 * de quien gestiona la seguridad vial.
 */
export async function saveRoadEventDetail(
  input: { tenantId: string; actor: RoadUser; incidentRecordId: string; detail: RoadEventDetailInput },
  db: Db = prisma,
) {
  const { tenantId, actor } = input;
  if (!canReportRoadEvent(actor)) throw new RoadSafetyError("Sin permiso para registrar eventos viales");
  const record = await db.incidentRecord.findFirst({
    where: { id: input.incidentRecordId, tenantId },
    select: { id: true, isRoad: true, classification: true, roadDetail: { select: { id: true } } },
  });
  if (!record) throw new RoadSafetyError("No se encontró la ficha del accidente");
  if (!record.isRoad) throw new RoadSafetyError("La ficha no está marcada como hecho de tránsito");
  if (record.roadDetail && !canManageRoadSafety(actor)) throw new RoadSafetyError("Solo quien gestiona la seguridad vial puede corregir el detalle");

  const data = await prepareRoadDetail(db, tenantId, record.classification, input.detail);
  if (!record.roadDetail) {
    return db.$transaction((tx) => insertRoadDetail(tx, { tenantId, incidentRecordId: record.id, actorUserId: actor.userId, data }));
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.roadEventDetail.update({ where: { incidentRecordId: record.id }, data });
    await audit(tx, {
      tenantId,
      entityType: "road_event",
      entityId: record.id,
      action: "update",
      actorUserId: actor.userId,
      summary: "Corrección del detalle vial del evento",
    });
    return updated;
  });
}

export type RoadEventView = {
  id: string;
  vehicleKind: PreparedRoadDetail["vehicleKind"];
  assetId: string | null;
  assetCode: string | null;
  vehicleLabel: string | null;
  /** Solo para quien gestiona la seguridad vial (D24); el resto recibe `null`. */
  driverPersonId: string | null;
  driverName: string | null;
  eventType: PreparedRoadDetail["eventType"];
  roadSurface: PreparedRoadDetail["roadSurface"];
  light: PreparedRoadDetail["light"];
  weather: PreparedRoadDetail["weather"];
  seatbelt: PreparedRoadDetail["seatbelt"];
  estimatedSpeedKmh: number | null;
  propertyDamage: PreparedRoadDetail["propertyDamage"];
  injuredCount: number;
  hospitalizedCount: number;
  fatalCount: number;
  mainCause: PreparedRoadDetail["mainCause"];
  reportFiled: boolean;
  reportRef: string | null;
};

/** Lee el detalle vial. El conductor solo se devuelve a quien gestiona, y esa consulta queda en el registro. */
export async function getRoadEventDetail(
  input: { tenantId: string; actor: RoadUser; incidentRecordId: string },
  db: Db = prisma,
): Promise<RoadEventView | null> {
  const row = await db.roadEventDetail.findFirst({
    where: { tenantId: input.tenantId, incidentRecordId: input.incidentRecordId },
    include: { asset: { select: { code: true } }, driver: { select: { name: true } } },
  });
  if (!row) return null;
  const seeDriver = canManageRoadSafety(input.actor) && row.driverPersonId !== null;
  if (seeDriver) {
    await audit(db, {
      tenantId: input.tenantId,
      entityType: "road_event_driver",
      entityId: input.incidentRecordId,
      action: "view",
      actorUserId: input.actor.userId,
      summary: "Consulta del conductor de un evento vial",
    });
  }
  return {
    id: row.id,
    vehicleKind: row.vehicleKind,
    assetId: row.assetId,
    assetCode: row.asset?.code ?? null,
    vehicleLabel: row.vehicleLabel,
    driverPersonId: seeDriver ? row.driverPersonId : null,
    driverName: seeDriver ? (row.driver?.name ?? null) : null,
    eventType: row.eventType,
    roadSurface: row.roadSurface,
    light: row.light,
    weather: row.weather,
    seatbelt: row.seatbelt,
    estimatedSpeedKmh: row.estimatedSpeedKmh,
    propertyDamage: row.propertyDamage,
    injuredCount: row.injuredCount,
    hospitalizedCount: row.hospitalizedCount,
    fatalCount: row.fatalCount,
    mainCause: row.mainCause,
    reportFiled: row.reportFiled,
    reportRef: row.reportRef,
  };
}

// ─── Km por vehículo y mes ──────────────────────────────────────────────────

async function loadOdometers(db: Db, tenantId: string, assetIds: string[], endExclusive: Date) {
  const [inspections, resets] = await Promise.all([
    assetIds.length === 0
      ? []
      : db.inspection.findMany({
          where: { tenantId, assetId: { in: assetIds }, status: "closed", readingKm: { not: null }, inspectedAt: { lt: endExclusive } },
          select: { assetId: true, inspectedAt: true, readingKm: true },
          orderBy: [{ closedAt: "asc" }, { id: "asc" }],
        }),
    assetIds.length === 0
      ? []
      : db.vehicleOdometerReset.findMany({
          where: { tenantId, assetId: { in: assetIds } },
          select: { assetId: true, effectiveOn: true },
        }),
  ]);
  const readings = new Map<string, OdometerReading[]>();
  inspections.forEach((i, seq) => {
    if (!i.assetId || i.readingKm === null) return;
    const list = readings.get(i.assetId) ?? [];
    list.push({ day: i.inspectedAt.toISOString().slice(0, 10), km: i.readingKm, seq });
    readings.set(i.assetId, list);
  });
  const resetsBy = new Map<string, OdometerReset[]>();
  for (const r of resets) {
    const list = resetsBy.get(r.assetId) ?? [];
    list.push({ effectiveOn: r.effectiveOn.toISOString().slice(0, 10) });
    resetsBy.set(r.assetId, list);
  }
  return { readings, resets: resetsBy };
}

export type KmGridRow = {
  assetId: string;
  code: string;
  description: string;
  computed: VehicleMonthKm;
  stored: { km: number; source: "odometer" | "manual"; computedKm: number | null; manualReason: string | null; confirmedAt: Date | null } | null;
  state: VehicleMonthState;
  km: number | null;
};

/** Vehículos de la flota con km durante `month`: no dados de baja (o dados de baja ese mes o después) y ya existentes. */
async function fleetForMonth(db: Db, tenantId: string, month: MonthKey) {
  return db.asset.findMany({
    where: {
      tenantId,
      typeKey: { in: FLEET_KM_TYPE_KEYS },
      createdAt: { lt: nextMonthStart(month) },
      OR: [{ status: { not: "retired" } }, { retiredAt: { gte: monthDate(month) } }],
    },
    select: { id: true, code: true, description: true },
    orderBy: { code: "asc" },
    take: 500,
  });
}

/** Grilla vehículo × mes: lo calculado de los odómetros, lo confirmado y el estado resultante. */
export async function getKmGrid(tenantId: string, month: MonthKey, db: Db = prisma): Promise<KmGridRow[]> {
  const vehicles = await fleetForMonth(db, tenantId, month);
  const ids = vehicles.map((v) => v.id);
  const [odometers, periods, rateEvents] = await Promise.all([
    loadOdometers(db, tenantId, ids, nextMonthStart(month)),
    db.vehicleKmPeriod.findMany({ where: { tenantId, assetId: { in: ids }, periodMonth: monthDate(month) } }),
    db.roadEventDetail.groupBy({
      by: ["assetId"],
      where: {
        tenantId,
        assetId: { in: ids },
        incidentRecord: { periodMonth: monthDate(month), inItinere: false, classification: { not: "near_miss" } },
      },
      _count: { _all: true },
    }),
  ]);
  const storedBy = new Map(periods.map((p) => [p.assetId, p]));
  const eventsBy = new Map(rateEvents.map((e) => [e.assetId, e._count._all]));
  return vehicles.map((v) => {
    const computed = computeVehicleMonthKm({
      month,
      readings: odometers.readings.get(v.id) ?? [],
      resets: odometers.resets.get(v.id) ?? [],
    });
    const row = storedBy.get(v.id) ?? null;
    const stored = row
      ? { km: row.km, source: row.source, computedKm: row.computedKm, manualReason: row.manualReason, confirmedAt: row.confirmedAt }
      : null;
    const final = classifyVehicleMonth({ computed, stored: stored ? { km: stored.km, source: stored.source } : null, rateEvents: eventsBy.get(v.id) ?? 0 });
    return { assetId: v.id, code: v.code, description: v.description, computed, stored, state: final.state, km: final.km };
  });
}

/**
 * Estado y km de cada vehículo en cada mes de `months` (consecutivos, el último es el más reciente): lo que
 * usa el tablero. Un vehículo cuenta en los meses en que ya existía y no estaba dado de baja. `rateEventCounts`
 * trae los eventos de la tasa por «activo|mes» para marcar km = 0 con eventos como inconsistente.
 */
export async function getFleetVehicleMonths(
  tenantId: string,
  months: readonly MonthKey[],
  rateEventCounts: ReadonlyMap<string, number>,
  db: Db = prisma,
): Promise<{ vehicleMonths: VehicleMonthRow[]; vehicles: FleetVehicle[] }> {
  if (months.length === 0) return { vehicleMonths: [], vehicles: [] };
  const first = months[0];
  const last = months[months.length - 1];
  const vehicles = await db.asset.findMany({
    where: {
      tenantId,
      typeKey: { in: FLEET_KM_TYPE_KEYS },
      createdAt: { lt: nextMonthStart(last) },
      OR: [{ status: { not: "retired" } }, { retiredAt: { gte: monthDate(first) } }],
    },
    select: { id: true, code: true, description: true, createdAt: true, retiredAt: true },
    orderBy: { code: "asc" },
    take: 500,
  });
  const ids = vehicles.map((v) => v.id);
  const [odometers, periods] = await Promise.all([
    loadOdometers(db, tenantId, ids, nextMonthStart(last)),
    ids.length === 0
      ? []
      : db.vehicleKmPeriod.findMany({
          where: { tenantId, assetId: { in: ids }, periodMonth: { gte: monthDate(first), lte: monthDate(last) } },
          select: { assetId: true, periodMonth: true, km: true, source: true },
        }),
  ]);
  const storedBy = new Map(periods.map((p) => [`${p.assetId}|${p.periodMonth.toISOString().slice(0, 7)}`, p]));
  const vehicleMonths: VehicleMonthRow[] = [];
  for (const v of vehicles) {
    for (const month of months) {
      if (v.createdAt >= nextMonthStart(month) || (v.retiredAt && v.retiredAt < monthDate(month))) continue;
      const key = `${v.id}|${month}`;
      const computed = computeVehicleMonthKm({ month, readings: odometers.readings.get(v.id) ?? [], resets: odometers.resets.get(v.id) ?? [] });
      const stored = storedBy.get(key);
      const final = classifyVehicleMonth({ computed, stored: stored ? { km: stored.km, source: stored.source } : null, rateEvents: rateEventCounts.get(key) ?? 0 });
      vehicleMonths.push({ assetId: v.id, month, state: final.state, km: final.km });
    }
  }
  return { vehicleMonths, vehicles: vehicles.map(({ id, code, description }) => ({ id, code, description })) };
}

export type VehicleMonthRow = { assetId: string; month: MonthKey; state: VehicleMonthState; km: number | null };

/**
 * Confirma el km calculado de un vehículo y mes (sin `km`) o lo carga/pisa a mano (con `km` y motivo
 * obligatorio, D13). Deja el valor calculado como referencia y registra el cambio.
 */
export async function saveVehicleKm(
  input: { tenantId: string; actor: RoadUser; assetId: string; month: MonthKey; km?: number | null; reason?: string | null; today?: IsoDay },
  db: Db = prisma,
) {
  const { tenantId, actor, assetId, month } = input;
  requireManager(actor);
  const today = input.today ?? localDay(new Date());
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RoadSafetyError("Mes inválido");
  if (!isKmMonthClosed(month, today)) throw new RoadSafetyError("El mes todavía no cerró: cargá los km cuando termine");

  const vehicle = (await fleetForMonth(db, tenantId, month)).find((v) => v.id === assetId);
  if (!vehicle) throw new RoadSafetyError("Elegí un vehículo de la flota");

  const odometers = await loadOdometers(db, tenantId, [assetId], nextMonthStart(month));
  const computed = computeVehicleMonthKm({ month, readings: odometers.readings.get(assetId) ?? [], resets: odometers.resets.get(assetId) ?? [] });

  const manual = input.km !== undefined && input.km !== null;
  let km: number;
  let manualReason: string | null = null;
  if (manual) {
    if (!Number.isInteger(input.km) || (input.km as number) < 0 || (input.km as number) > 1_000_000) {
      throw new RoadSafetyError("Los km del mes son un número entero entre 0 y 1.000.000", { km: "Km inválidos" });
    }
    km = input.km as number;
    manualReason = checkReason(input.reason);
  } else {
    if (computed.km === null || (computed.status !== "ok" && computed.status !== "allocated")) {
      throw new RoadSafetyError(
        computed.status === "inconsistent"
          ? "Los odómetros no cierran (una lectura baja). Corregí la lectura, marcá un reinicio o cargá los km a mano."
          : "No hay lecturas de odómetro para calcular este mes: cargá los km a mano.",
      );
    }
    km = computed.km;
  }

  const periodMonth = monthDate(month);
  const key = { tenantId_assetId_periodMonth: { tenantId, assetId, periodMonth } };
  const row = await db.$transaction(async (tx) => {
    const before = await tx.vehicleKmPeriod.findUnique({ where: key, select: { km: true, source: true } });
    const data = {
      km,
      source: manual ? ("manual" as const) : ("odometer" as const),
      computedKm: computed.km,
      manualReason,
      confirmedAt: new Date(),
      actorUserId: actor.userId,
    };
    const saved = await tx.vehicleKmPeriod.upsert({ where: key, create: { tenantId, assetId, periodMonth, ...data }, update: data });
    await audit(tx, {
      tenantId,
      entityType: "road_km",
      entityId: saved.id,
      action: before ? "update" : "create",
      actorUserId: actor.userId,
      summary: `${manual ? "Km cargados a mano" : "Km confirmados"} de ${vehicle.code} en ${monthLabel(month)}: ${km}${before ? ` (antes ${before.km})` : ""}`,
    });
    return saved;
  });
  await syncKmDueItemsSafely(tenantId, db);
  return row;
}

/** Marca un reinicio o cambio de tablero: corta la serie de odómetro de ese vehículo (D14). */
export async function addOdometerReset(
  input: { tenantId: string; actor: RoadUser; assetId: string; effectiveOn: IsoDay; reason: string },
  db: Db = prisma,
) {
  requireManager(input.actor);
  if (!isIsoDay(input.effectiveOn)) throw new RoadSafetyError("Fecha inválida", { effectiveOn: "Fecha inválida" });
  const reason = checkReason(input.reason);
  const asset = await db.asset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId, typeKey: { in: FLEET_KM_TYPE_KEYS } }, select: { id: true, code: true } });
  if (!asset) throw new RoadSafetyError("Elegí un vehículo de la flota");
  const existing = await db.vehicleOdometerReset.findFirst({ where: { assetId: asset.id, effectiveOn: dayDate(input.effectiveOn) }, select: { id: true } });
  if (existing) throw new RoadSafetyError("Ese vehículo ya tiene un reinicio en esa fecha", { effectiveOn: "Ya hay un reinicio ese día" });
  return db.$transaction(async (tx) => {
    const created = await tx.vehicleOdometerReset.create({
      data: { tenantId: input.tenantId, assetId: asset.id, effectiveOn: dayDate(input.effectiveOn), reason, actorUserId: input.actor.userId },
    });
    await audit(tx, {
      tenantId: input.tenantId,
      entityType: "road_odometer_reset",
      entityId: created.id,
      action: "create",
      actorUserId: input.actor.userId,
      summary: `Reinicio de odómetro de ${asset.code} el ${input.effectiveOn}`,
    });
    return created;
  });
}

// ─── Aviso mensual de km (DueItem) ──────────────────────────────────────────

/**
 * Deja un aviso abierto por mes (el último cerrado, y los anteriores que sigan abiertos) mientras algún vehículo
 * de la flota no tenga los km confirmados. Vence el día 10 del mes siguiente, con aviso 5 días antes. Se cierra
 * al confirmar todos. Idempotente: nunca duplica.
 */
export async function syncKmDueItems(
  tenantId: string,
  opts: { today?: IsoDay } = {},
  db: Db = prisma,
): Promise<{ opened: MonthKey[]; closed: MonthKey[] }> {
  const today = opts.today ?? localDay(new Date());
  const open = await db.dueItem.findMany({
    where: { tenantId, entityType: KM_DUE_ENTITY_TYPE, status: "open" },
    select: { id: true, entityId: true, title: true, dueAt: true },
  });
  const openBy = new Map(open.map((o) => [o.entityId, o]));
  const months = new Set<MonthKey>([lastClosedMonth(today), ...open.map((o) => o.entityId).filter((m): m is string => Boolean(m))]);
  const result: { opened: MonthKey[]; closed: MonthKey[] } = { opened: [], closed: [] };

  for (const month of [...months].sort()) {
    const fleet = await fleetForMonth(db, tenantId, month);
    const confirmed = await db.vehicleKmPeriod.count({
      where: { tenantId, periodMonth: monthDate(month), assetId: { in: fleet.map((v) => v.id) } },
    });
    if (fleet.length === 0 || confirmed >= fleet.length) {
      await closeDueItemsForEntity({ tenantId, entityType: KM_DUE_ENTITY_TYPE, entityId: month }, db);
      result.closed.push(month);
      continue;
    }
    const title = `Confirmar los km de la flota de ${monthLabel(month)}`;
    const dueAt = dayDate(kmDueDay(month));
    const current = openBy.get(month);
    if (!current) {
      await createDueItem({ tenantId, title, entityType: KM_DUE_ENTITY_TYPE, entityId: month, dueAt, leadDays: KM_LEAD_DAYS }, db);
    } else if (current.title !== title || current.dueAt.getTime() !== dueAt.getTime()) {
      // Solo se toca si cambió algo: reescribirlo cada vez reiniciaría el aviso ya enviado.
      await db.dueItem.update({ where: { id: current.id }, data: { title, dueAt, remindAt: reminderStartsAt(dueAt, KM_LEAD_DAYS) } });
    }
    result.opened.push(month);
  }
  return result;
}

/** Los avisos no son la operación principal: si fallan, se registra y lo ya guardado sigue en pie. */
export async function syncKmDueItemsSafely(tenantId: string, db: Db = prisma): Promise<void> {
  try {
    await syncKmDueItems(tenantId, {}, db);
  } catch (error) {
    console.error(JSON.stringify({ event: "road_safety.km_sync.failed", tenantId, error: error instanceof Error ? error.message : String(error) }));
  }
}

