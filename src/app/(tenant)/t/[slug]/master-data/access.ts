import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";

/** Sesión, empresa y permisos de datos maestros. El layout del tenant ya garantizó la lectura. */
export async function loadMasterDataAccess(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  return {
    ctx,
    tenant,
    canManage: canTenantRole(membership?.role, "manage_master_data", opts),
    canAssignTasks: canTenantRole(membership?.role, "assign_job_tasks", opts),
  };
}
