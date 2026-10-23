import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";

/** Sesión, empresa y permisos de Equipos de medición. El layout del módulo ya garantizó que está activo. */
export async function loadInstrumentsAccess(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  const can = (action: AuthzAction) => canTenantRole(membership?.role, action, { isPlatformSuperuser: ctx.isPlatformSuperuser });
  return {
    ctx,
    tenant,
    role: membership?.role ?? null,
    canWrite: can("write"),
    canManage: can("manage_calibration"),
  };
}
