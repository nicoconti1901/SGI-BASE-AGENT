import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";

/** Sesión, empresa y permisos de capacitaciones. El layout del tenant ya garantizó la lectura. */
export async function loadTrainingAccess(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  return {
    ctx,
    tenant,
    canManage: canTenantRole(membership?.role, "manage_training", opts),
    canRecord: canTenantRole(membership?.role, "record_training", opts),
  };
}
