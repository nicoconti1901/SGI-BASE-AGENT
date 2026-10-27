"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";
import { InspectionError } from "@/lib/inspection-support";
import { setMonthlyTarget, startFieldAudit } from "@/lib/inspection-field-audit";

/** Sesión + permiso + módulo activo. Siempre en el servidor: ocultar el botón no alcanza. */
async function requireAccess(slug: string, action: AuthzAction, denied: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) redirect("/");
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!canTenantRole(membership?.role, action, { isPlatformSuperuser: ctx.isPlatformSuperuser })) throw new InspectionError(denied);
  if (!(await getEnabledModulesCached(tenant.id)).has("inspections")) throw new InspectionError("El módulo no está activo");
  return { ctx, tenant };
}

function back(slug: string, error: string): never {
  redirect(`/t/${slug}/inspections/campo?error=${encodeURIComponent(error)}`);
}

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Empezar la auditoría en campo de una sede y abrir su pantalla. */
export async function startFieldAuditAction(slug: string, formData: FormData): Promise<void> {
  let id: string;
  try {
    const { ctx, tenant } = await requireAccess(slug, "write", "Tu rol no permite registrar inspecciones");
    const siteId = text(formData, "siteId");
    if (!siteId) throw new InspectionError("Elegí la sede");
    id = (
      await startFieldAudit({
        tenantId: tenant.id,
        actorUserId: ctx.userId,
        siteId,
        jobTaskId: text(formData, "jobTaskId"),
        contractorName: text(formData, "contractorName"),
        supervisorPersonId: text(formData, "supervisorPersonId"),
        specialTasks: formData.getAll("specialTasks").filter((v): v is string => typeof v === "string"),
      })
    ).id;
  } catch (error) {
    if (error instanceof InspectionError) back(slug, error.message);
    throw error;
  }
  redirect(`/t/${slug}/inspections/${id}`);
}

/** Fijar o quitar la meta mensual de una sede: lo hace quien gestiona activos. */
export async function setMonthlyTargetAction(slug: string, siteId: string, formData: FormData): Promise<void> {
  try {
    const { ctx, tenant } = await requireAccess(slug, "manage_assets", "Tu rol no permite cambiar la meta mensual");
    await setMonthlyTarget({ tenantId: tenant.id, actorUserId: ctx.userId, siteId, target: text(formData, "target") });
    revalidatePath(`/t/${slug}/inspections/campo`);
  } catch (error) {
    if (error instanceof InspectionError) back(slug, error.message);
    throw error;
  }
  redirect(`/t/${slug}/inspections/campo`);
}
