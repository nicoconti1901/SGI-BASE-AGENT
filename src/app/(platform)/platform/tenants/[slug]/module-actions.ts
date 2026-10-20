"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { setModuleEnabled } from "@/lib/modules";

/** Activa o desactiva un módulo para una empresa. Solo el superusuario de plataforma. */
export async function setTenantModuleAction(slug: string, moduleKey: string, enabled: boolean): Promise<void> {
  const ctx = await getAppSessionContext();
  if (!ctx?.isPlatformSuperuser) throw new Error("Solo el superusuario de plataforma gestiona los módulos");

  const tenant = await getTenantBySlug(slug);
  if (!tenant) throw new Error("Empresa no encontrada");

  await setModuleEnabled({ tenantId: tenant.id, moduleKey, enabled, actorUserId: ctx.userId });
  revalidatePath(`/platform/tenants/${slug}`);
  revalidatePath(`/t/${slug}`, "layout");
}
