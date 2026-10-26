import { notFound, redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";

/** Sesión, empresa y permisos de proveedores. El layout del tenant ya garantizó la lectura. */
export async function loadSupplierAccess(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) redirect("/login");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  return {
    ctx,
    tenant,
    canManage: canTenantRole(membership?.role, "manage_suppliers", opts),
    /** Crear hallazgos: el permiso vigente de Hallazgos, no el de administrar proveedores. */
    canRegisterFinding: canTenantRole(membership?.role, "write", opts),
    canEvaluate: canTenantRole(membership?.role, "evaluate_suppliers", opts),
    canUpload: canTenantRole(membership?.role, "upload_supplier_documents", opts),
    canEditCriteria: canTenantRole(membership?.role, "manage_supplier_criteria", opts),
  };
}
