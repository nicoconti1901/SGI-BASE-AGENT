import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";

/** Sesión, empresa y permisos de auditoría. El layout ya garantizó la lectura. */
export async function loadAuditsAccess(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  return {
    ctx,
    tenant,
    canPlan: canTenantRole(membership?.role, "plan_audits", opts),
    canApprove: canTenantRole(membership?.role, "approve_audit_program", opts),
  };
}

export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("es-AR", { timeZone: "UTC" });
}
