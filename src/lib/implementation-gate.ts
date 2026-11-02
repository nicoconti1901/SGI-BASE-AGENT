import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  canImplement,
  implementationLockMessage,
  type ImplementationKind,
} from "@/domain/risks/ownership";

export class ImplementationGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImplementationGateError";
  }
}

type Db = PrismaClient;

async function loadTarget(db: Db, tenantId: string, kind: ImplementationKind, id: string) {
  if (kind === "risk") {
    const r = await db.risk.findFirst({ where: { id, tenantId }, select: { status: true, responseOwnerUserId: true } });
    return r ? { status: r.status as string, ownerUserId: r.responseOwnerUserId } : null;
  }
  const o = await db.opportunity.findFirst({ where: { id, tenantId }, select: { status: true, pursuitOwnerUserId: true } });
  return o ? { status: o.status as string, ownerUserId: o.pursuitOwnerUserId } : null;
}

/**
 * Corta si la persona no puede avanzar este riesgo u oportunidad (acciones, estado, decisión, cierre).
 * Ver `canImplement`: antes de asignar lo avanza quien escribe; después, solo el responsable, quien tenga a cargo
 * la acción o el superusuario.
 */
export async function assertCanImplementTarget(input: {
  tenantId: string;
  kind: ImplementationKind;
  targetId: string;
  actorUserId: string;
  isPlatformSuperuser: boolean;
  actionOwnerUserId?: string | null;
  db?: Db;
}) {
  const db = input.db ?? prisma;
  const target = await loadTarget(db, input.tenantId, input.kind, input.targetId);
  if (!target) return;
  const allowed = canImplement(input.kind, {
    status: target.status,
    ownerUserId: target.ownerUserId,
    actorUserId: input.actorUserId,
    isPlatformSuperuser: input.isPlatformSuperuser,
    actionOwnerUserId: input.actionOwnerUserId,
  });
  if (allowed) return;
  const owner = target.ownerUserId
    ? await db.user.findUnique({ where: { id: target.ownerUserId }, select: { name: true } })
    : null;
  throw new ImplementationGateError(implementationLockMessage(input.kind, owner?.name ?? "Otra persona"));
}

/** Lo mismo para una acción: se mira el riesgo u oportunidad al que está vinculada. */
export async function assertCanImplementAction(input: {
  tenantId: string;
  actionId: string;
  actorUserId: string;
  isPlatformSuperuser: boolean;
  db?: Db;
}) {
  const db = input.db ?? prisma;
  const action = await db.action.findFirst({
    where: { id: input.actionId, tenantId: input.tenantId },
    select: { ownerUserId: true, links: { select: { targetType: true, targetId: true } } },
  });
  if (!action) return;
  for (const link of action.links) {
    if (link.targetType !== "risk" && link.targetType !== "opportunity") continue;
    await assertCanImplementTarget({
      tenantId: input.tenantId,
      kind: link.targetType,
      targetId: link.targetId,
      actorUserId: input.actorUserId,
      isPlatformSuperuser: input.isPlatformSuperuser,
      actionOwnerUserId: action.ownerUserId,
      db,
    });
  }
}
