import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { requireModuleEnabled } from "@/lib/modules";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";
import { SupplierError } from "@/lib/suppliers";

export type SupplierActionState = { error?: string; ok?: string };

/** Sesión, permiso por rol y módulo activo: los permisos se controlan acá, no solo ocultando botones. */
export async function requireSupplierAccess(slug: string, action: AuthzAction) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!canTenantRole(membership?.role, action, { isPlatformSuperuser: ctx.isPlatformSuperuser })) {
    return { error: "Tu rol no tiene permiso para esta acción" } as const;
  }
  await requireModuleEnabled(tenant.id, "suppliers");
  return { ctx, tenant } as const;
}

export function supplierFailure(error: unknown): SupplierActionState {
  if (error instanceof SupplierError) return { error: error.message };
  console.error(error);
  return { error: "No se pudo guardar. Probá de nuevo." };
}

export const formText = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** `YYYY-MM-DD` → medianoche UTC; vacío → null; inválido → error. */
export function formDate(formData: FormData, key: string): Date | null {
  const raw = formText(formData, key).trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new SupplierError("Una de las fechas no es válida");
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new SupplierError("Una de las fechas no es válida");
  return date;
}
