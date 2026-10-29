/**
 * Conductores habilitados (SPEC-road-safety.md, 18.4, D20): licencia vigente más manejo defensivo vigente.
 * El manejo defensivo sale de la tarea de conducción que elige la empresa (Task 20, `isQualifiedForTask`). La
 * lista con nombres es de quien gestiona la seguridad vial (D24); el resto recibe solo el resumen.
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

/** Tope de conductores que se evalúan por empresa: son personas con la tarea de conducción asignada. */
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

/** Carga o cambia el vencimiento de la licencia de una persona de la empresa; `null` la borra. */
export async function saveDriverLicense(input: { tenantId: string; actor: RoadUser; personId: string; expiresOn: IsoDay | null }, db: Db = prisma) {
  requireManager(input.actor);
  const { tenantId, personId, expiresOn } = input;
  if (expiresOn !== null && !isIsoDay(expiresOn)) throw new RoadSafetyError("Fecha de vencimiento inválida");
  const person = await db.person.findFirst({ where: { id: personId, tenantId }, select: { id: true } });
  if (!person) throw new RoadSafetyError("La persona no es de la empresa");
  await db.$transaction(async (tx) => {
    if (expiresOn === null) await tx.driverLicense.deleteMany({ where: { tenantId, personId } });
    else {
      await tx.driverLicense.upsert({
        where: { personId },
        create: { tenantId, personId, expiresOn: dayDate(expiresOn), actorUserId: input.actor.userId },
        update: { expiresOn: dayDate(expiresOn), actorUserId: input.actor.userId },
      });
    }
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
 * Evalúa a las personas activas con la tarea de conducción asignada. Sin tarea elegida no hay conductores que
 * evaluar: `configured` es falso y el tablero lo dice en lugar de mostrar 0.
 */
export async function loadDriverEligibility(tenantId: string, today: IsoDay, db: Db = prisma) {
  const task = await getDriverTask(tenantId, db);
  if (!task) return { configured: false as const, task: null, rows: [] as DriverRow[], truncated: false };

  const assigned = await db.personJobTask.findMany({
    where: { tenantId, jobTaskId: task.id, person: { status: "active" } },
    select: { person: { select: { id: true, name: true, employeeCode: true, driverLicense: { select: { expiresOn: true } } } } },
    orderBy: { person: { name: "asc" } },
    take: DRIVERS_LIMIT + 1,
  });
  const truncated = assigned.length > DRIVERS_LIMIT;
  const people = assigned.slice(0, DRIVERS_LIMIT).map((a) => a.person);

  const qualifications = new Map<string, { qualified: boolean; hasRequirements: boolean }>();
  for (let i = 0; i < people.length; i += QUALIFICATION_MAX_PEOPLE) {
    const chunk = people.slice(i, i + QUALIFICATION_MAX_PEOPLE).map((p) => p.id);
    const result = await getTaskQualifications(tenantId, chunk, task.id, { today }, db);
    for (const [id, q] of result ?? []) qualifications.set(id, { qualified: q.qualified, hasRequirements: q.hasRequirements });
  }

  const rows: DriverRow[] = people.map((p) => {
    const licenseExpiresOn = p.driverLicense ? isoOf(p.driverLicense.expiresOn) : null;
    const { enabled, blockers } = driverEligibility({ licenseExpiresOn, qualification: qualifications.get(p.id) ?? null }, today);
    return { personId: p.id, employeeCode: p.employeeCode, name: p.name, licenseExpiresOn, enabled, blockers };
  });
  return { configured: true as const, task, rows, truncated };
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
