/**
 * Conductores habilitados (SPEC-road-safety.md, 18.4, D20): licencia vigente más manejo defensivo vigente.
 * Conductor es una marca de la persona que se gestiona acá (`RoadDriver`, con el vencimiento de su licencia). El
 * manejo defensivo sale de los cursos obligatorios de la tarea de conducción que elige la empresa (Task 20,
 * `isQualifiedForTask`, que no exige que la tarea esté asignada). La lista con nombres es de quien gestiona la
 * seguridad vial (D24); el resto recibe solo el resumen.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTaskQualifications, QUALIFICATION_MAX_PEOPLE } from "@/lib/training";
import { RoadSafetyError, type RoadUser } from "@/lib/road-safety";
import { canManageRoadSafety } from "@/domain/road-safety/access";
import { driverEligibility, summarizeEligibility, type DriverBlocker } from "@/domain/road-safety/dashboard";
import { isIsoDay } from "@/domain/safety-stats/period";
import type { IsoDay } from "@/domain/safety-stats/types";

type Db = PrismaClient;

/** Tope de conductores que se evalúan por empresa. */
export const DRIVERS_LIMIT = 500;

const dayDate = (day: IsoDay) => new Date(`${day}T00:00:00.000Z`);
const isoOf = (d: Date): IsoDay => d.toISOString().slice(0, 10);

function requireManager(actor: RoadUser) {
  if (!canManageRoadSafety(actor)) throw new RoadSafetyError("Tu rol no permite gestionar la seguridad vial");
}

export async function getDriverTask(tenantId: string, db: Db = prisma): Promise<{ id: string; name: string } | null> {
  const settings = await db.roadSafetySettings.findUnique({ where: { tenantId }, select: { driverTask: { select: { id: true, name: true } } } });
  return settings?.driverTask ?? null;
}

/** Elige (o quita, con `null`) la tarea de conducción cuyos cursos obligatorios prueban el manejo defensivo. */
export async function setDriverTask(input: { tenantId: string; actor: RoadUser; jobTaskId: string | null }, db: Db = prisma) {
  requireManager(input.actor);
  if (input.jobTaskId !== null) {
    const task = await db.jobTask.findFirst({ where: { id: input.jobTaskId, tenantId: input.tenantId, active: true }, select: { id: true } });
    if (!task) throw new RoadSafetyError("La tarea no existe o está dada de baja");
  }
  await db.$transaction(async (tx) => {
    await tx.roadSafetySettings.upsert({
      where: { tenantId: input.tenantId },
      create: { tenantId: input.tenantId, driverTaskId: input.jobTaskId },
      update: { driverTaskId: input.jobTaskId },
    });
    await tx.masterDataAudit.create({
      data: {
        tenantId: input.tenantId,
        entityType: "road_settings",
        entityId: input.tenantId,
        action: "update",
        actorUserId: input.actor.userId,
        summary: input.jobTaskId ? "Tarea de conducción elegida para los conductores habilitados" : "Tarea de conducción quitada",
      },
    });
  });
}

/** Marca a una persona activa de la empresa como conductor. Es idempotente: si ya lo era, no cambia nada. */
export async function addDriver(input: { tenantId: string; actor: RoadUser; personId: string }, db: Db = prisma) {
  requireManager(input.actor);
  const { tenantId, personId } = input;
  const person = await db.person.findFirst({ where: { id: personId, tenantId, status: "active" }, select: { id: true, name: true } });
  if (!person) throw new RoadSafetyError("La persona no es de la empresa o está dada de baja");
  if (await db.roadDriver.findUnique({ where: { personId }, select: { id: true } })) return;
  await db.$transaction(async (tx) => {
    await tx.roadDriver.create({ data: { tenantId, personId, actorUserId: input.actor.userId } });
    await tx.masterDataAudit.create({
      data: { tenantId, entityType: "road_driver", entityId: personId, action: "create", actorUserId: input.actor.userId, summary: `Alta de conductor: ${person.name}` },
    });
  });
}

/** Saca la marca de conductor (y con ella el vencimiento de la licencia cargado). */
export async function removeDriver(input: { tenantId: string; actor: RoadUser; personId: string }, db: Db = prisma) {
  requireManager(input.actor);
  const { tenantId, personId } = input;
  await db.$transaction(async (tx) => {
    const { count } = await tx.roadDriver.deleteMany({ where: { tenantId, personId } });
    if (count === 0) return;
    await tx.masterDataAudit.create({
      data: { tenantId, entityType: "road_driver", entityId: personId, action: "update", actorUserId: input.actor.userId, summary: "Baja de la marca de conductor" },
    });
  });
}

/** Carga o cambia el vencimiento de la licencia de un conductor; `null` lo quita (queda sin licencia cargada). */
export async function saveDriverLicense(input: { tenantId: string; actor: RoadUser; personId: string; expiresOn: IsoDay | null }, db: Db = prisma) {
  requireManager(input.actor);
  const { tenantId, personId, expiresOn } = input;
  if (expiresOn !== null && !isIsoDay(expiresOn)) throw new RoadSafetyError("Fecha de vencimiento inválida");
  const driver = await db.roadDriver.findFirst({ where: { tenantId, personId }, select: { id: true } });
  if (!driver) throw new RoadSafetyError("La persona no está marcada como conductor");
  await db.$transaction(async (tx) => {
    await tx.roadDriver.update({
      where: { id: driver.id },
      data: { licenseExpiresOn: expiresOn ? dayDate(expiresOn) : null, actorUserId: input.actor.userId },
    });
    await tx.masterDataAudit.create({
      data: {
        tenantId,
        entityType: "driver_license",
        entityId: personId,
        action: "update",
        actorUserId: input.actor.userId,
        summary: expiresOn ? `Licencia de conducir vigente hasta ${expiresOn}` : "Licencia de conducir quitada",
      },
    });
  });
}

export type DriverRow = {
  personId: string;
  employeeCode: string;
  name: string;
  licenseExpiresOn: IsoDay | null;
  enabled: boolean;
  blockers: DriverBlocker[];
};

/**
 * Evalúa a los conductores activos. Sin tarea de conducción elegida (`configured` falso) nadie puede probar el
 * manejo defensivo: todos quedan no habilitados con ese motivo, y el tablero lo dice en lugar de mostrar 0.
 */
export async function loadDriverEligibility(tenantId: string, today: IsoDay, db: Db = prisma) {
  const task = await getDriverTask(tenantId, db);
  const drivers = await db.roadDriver.findMany({
    where: { tenantId, person: { status: "active" } },
    select: { licenseExpiresOn: true, person: { select: { id: true, name: true, employeeCode: true } } },
    orderBy: { person: { name: "asc" } },
    take: DRIVERS_LIMIT + 1,
  });
  const truncated = drivers.length > DRIVERS_LIMIT;
  const shown = drivers.slice(0, DRIVERS_LIMIT);

  const qualifications = new Map<string, { qualified: boolean; hasRequirements: boolean }>();
  if (task) {
    for (let i = 0; i < shown.length; i += QUALIFICATION_MAX_PEOPLE) {
      const chunk = shown.slice(i, i + QUALIFICATION_MAX_PEOPLE).map((d) => d.person.id);
      const result = await getTaskQualifications(tenantId, chunk, task.id, { today }, db);
      for (const [id, q] of result ?? []) qualifications.set(id, { qualified: q.qualified, hasRequirements: q.hasRequirements });
    }
  }

  const rows: DriverRow[] = shown.map((d) => {
    const licenseExpiresOn = d.licenseExpiresOn ? isoOf(d.licenseExpiresOn) : null;
    const { enabled, blockers } = driverEligibility({ licenseExpiresOn, qualification: task ? (qualifications.get(d.person.id) ?? null) : null }, today);
    return { personId: d.person.id, employeeCode: d.person.employeeCode, name: d.person.name, licenseExpiresOn, enabled, blockers };
  });
  return { configured: task !== null, task, rows, truncated };
}

/** Resumen sin nombres para el tablero: lo ven todos los roles. */
export async function getDriverSummary(tenantId: string, today: IsoDay, db: Db = prisma) {
  const result = await loadDriverEligibility(tenantId, today, db);
  return { configured: result.configured, taskName: result.task?.name ?? null, ...summarizeEligibility(result.rows.map((r) => r.enabled)) };
}

/** Lista con nombres, licencias y motivos: solo quien gestiona; la consulta queda registrada. */
export async function listDrivers(input: { tenantId: string; actor: RoadUser; today: IsoDay }, db: Db = prisma) {
  requireManager(input.actor);
  const result = await loadDriverEligibility(input.tenantId, input.today, db);
  if (result.rows.length > 0) {
    await db.masterDataAudit.create({
      data: {
        tenantId: input.tenantId,
        entityType: "road_drivers_list",
        entityId: input.tenantId,
        action: "view",
        actorUserId: input.actor.userId,
        summary: `Consulta de la lista de conductores habilitados (${result.rows.length})`,
      },
    });
  }
  return result;
}
