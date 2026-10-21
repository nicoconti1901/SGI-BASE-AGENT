import type { Prisma, PrismaClient } from "@prisma/client";
import { reminderStartsAt } from "@/domain/automation/due";

export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;

/** Error de negocio con un mensaje listo para mostrar en la UI. */
export class InspectionError extends Error {
  constructor(
    message: string,
    readonly code: string = "invalid",
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "InspectionError";
  }
}

export async function writeAudit(
  db: Db | Tx,
  input: { tenantId: string; entityType: string; entityId: string; action: string; actorUserId: string | null; summary: string },
) {
  await db.inspectionAudit.create({ data: input });
}

export type DueItemSpec = {
  tenantId: string;
  entityType: "inspection_plan" | "asset_due_date";
  entityId: string;
  title: string;
  dueAt: Date;
  leadDays: number;
  ownerUserId: string | null;
  siteId: string | null;
  personId: string | null;
};

/** Fila de `DueItem` con el mismo cálculo de `remindAt` que `src/lib/automation.ts`. */
export function dueItemRow(spec: DueItemSpec) {
  return {
    tenantId: spec.tenantId,
    title: spec.title,
    entityType: spec.entityType,
    entityId: spec.entityId,
    dueAt: spec.dueAt,
    leadDays: spec.leadDays,
    remindAt: reminderStartsAt(spec.dueAt, spec.leadDays),
    ownerUserId: spec.ownerUserId,
    siteId: spec.siteId,
    personId: spec.personId,
    status: "open" as const,
  };
}

/**
 * Deja exactamente un vencimiento abierto para la entidad: actualiza el que hay o crea uno.
 * Si por una carrera hubiera más de uno abierto, cierra los sobrantes. Es la versión transaccional de
 * `upsertOpenDueItemForEntity`, que no acepta un cliente de transacción.
 */
export async function syncOpenDueItem(tx: Tx, spec: DueItemSpec) {
  const open = await tx.dueItem.findMany({
    where: { tenantId: spec.tenantId, entityType: spec.entityType, entityId: spec.entityId, status: "open" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const [keep, ...extra] = open;
  if (extra.length > 0) await tx.dueItem.updateMany({ where: { id: { in: extra.map((d) => d.id) } }, data: { status: "closed" } });
  const row = dueItemRow(spec);
  if (!keep) return tx.dueItem.create({ data: row });
  return tx.dueItem.update({
    where: { id: keep.id },
    data: {
      title: row.title,
      dueAt: row.dueAt,
      leadDays: row.leadDays,
      remindAt: row.remindAt,
      ownerUserId: row.ownerUserId,
      siteId: row.siteId,
      personId: row.personId,
      lastReminderKind: null,
      lastRemindedAt: null,
    },
  });
}

export async function closeOpenDueItems(tx: Tx, tenantId: string, entityType: DueItemSpec["entityType"], entityIds: string[]) {
  if (entityIds.length === 0) return;
  await tx.dueItem.updateMany({ where: { tenantId, entityType, entityId: { in: entityIds }, status: "open" }, data: { status: "closed" } });
}

/** Quién recibe el aviso: el usuario de la persona asignada, si tiene. */
export async function ownerOfPerson(db: Db | Tx, tenantId: string, personId: string | null): Promise<string | null> {
  if (!personId) return null;
  const person = await db.person.findFirst({ where: { id: personId, tenantId }, select: { userId: true } });
  return person?.userId ?? null;
}
