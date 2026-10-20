import type { PrismaClient } from "@prisma/client";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import {
  canDisableModule,
  enabledModuleKeys,
  findModule,
  type ModuleKey,
} from "@/domain/modules/catalog";

export class ModuleActivationError extends Error {}

export async function getEnabledModules(tenantId: string, db: PrismaClient = prisma): Promise<Set<ModuleKey>> {
  const activations = await db.tenantModuleActivation.findMany({
    where: { tenantId },
    select: { moduleKey: true, enabled: true },
  });
  return enabledModuleKeys(activations);
}

/** Una sola consulta por request aunque la pidan el layout de la empresa y el del módulo. */
export const getEnabledModulesCached = cache((tenantId: string) => getEnabledModules(tenantId));

/** Recorte de alcance del cliente (no reemplaza los permisos por rol): un módulo inactivo responde 404. */
export async function requireModuleEnabled(tenantId: string, key: ModuleKey): Promise<void> {
  if (!(await getEnabledModulesCached(tenantId)).has(key)) notFound();
}

/** Para el layout de cada módulo bajo /t/[slug]. */
const tenantBySlugCached = cache(getTenantBySlug);

export async function requireModuleForSlug(slug: string, key: ModuleKey): Promise<void> {
  const tenant = await tenantBySlugCached(slug);
  if (!tenant) notFound();
  await requireModuleEnabled(tenant.id, key);
}

export async function setModuleEnabled(
  input: { tenantId: string; moduleKey: string; enabled: boolean; actorUserId: string | null },
  db: PrismaClient = prisma,
) {
  const mod = findModule(input.moduleKey);
  if (!mod) throw new ModuleActivationError("Módulo desconocido");
  if (mod.status !== "available") throw new ModuleActivationError(`${mod.label} todavía no está disponible`);
  if (!input.enabled && !canDisableModule(mod.key)) {
    throw new ModuleActivationError(`${mod.label} no se puede desactivar`);
  }
  return db.tenantModuleActivation.upsert({
    where: { tenantId_moduleKey: { tenantId: input.tenantId, moduleKey: mod.key } },
    create: {
      tenantId: input.tenantId,
      moduleKey: mod.key,
      enabled: input.enabled,
      updatedByUserId: input.actorUserId,
    },
    update: { enabled: input.enabled, updatedByUserId: input.actorUserId },
  });
}
