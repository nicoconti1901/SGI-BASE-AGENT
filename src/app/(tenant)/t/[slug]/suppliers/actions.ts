"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { requireModuleEnabled } from "@/lib/modules";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";
import {
  SupplierError,
  applySupplierImport,
  createSupplier,
  deactivateSupplier,
  linkPersonToSupplier,
  previewSupplierImport,
  reactivateSupplier,
  recordApprovedListExport,
  unlinkPersonFromSupplier,
  updateSupplier,
  getApprovedList,
  type SupplierInput,
} from "@/lib/suppliers";
import type { SupplierCriticalityValue, SupplierTypeValue } from "@/domain/suppliers/types";
import type { SupplierCsvError } from "@/domain/suppliers/import";

export type SupplierActionState = { error?: string; ok?: string };

const MAX_CSV_BYTES = 2 * 1024 * 1024;

/** Sesión, permiso por rol y módulo activo: los permisos se controlan acá, no solo ocultando botones. */
async function requireAccess(slug: string, action: AuthzAction) {
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

function fail(error: unknown): SupplierActionState {
  if (error instanceof SupplierError) return { error: error.message };
  console.error(error);
  return { error: "No se pudo guardar. Probá de nuevo." };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function supplierInput(formData: FormData): SupplierInput {
  return {
    legalName: text(formData, "legalName"),
    tradeName: text(formData, "tradeName") || null,
    taxId: text(formData, "taxId") || null,
    type: text(formData, "type") as SupplierTypeValue,
    category: text(formData, "category") || null,
    criticality: text(formData, "criticality") as SupplierCriticalityValue,
    criticalityReason: text(formData, "criticalityReason") || null,
    ownerUserId: text(formData, "ownerUserId") || null,
    contactName: text(formData, "contactName") || null,
    contactEmail: text(formData, "contactEmail") || null,
    contactPhone: text(formData, "contactPhone") || null,
    notes: text(formData, "notes") || null,
    siteIds: formData.getAll("siteIds").map(String),
  };
}

/** Alta (`supplierId` nulo) o edición. Ambas llevan a la ficha. */
export async function saveSupplierAction(
  slug: string,
  supplierId: string | null,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireAccess(slug, "manage_suppliers");
  if ("error" in access) return { error: access.error };
  const base = { tenantId: access.tenant.id, actorUserId: access.ctx.userId, ...supplierInput(formData) };
  let id: string;
  try {
    id = supplierId ? (await updateSupplier({ ...base, id: supplierId })).id : (await createSupplier(base)).id;
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/suppliers`);
  redirect(`/t/${slug}/suppliers/${id}`);
}

export async function setSupplierActiveAction(
  slug: string,
  supplierId: string,
  active: boolean,
  _prev: SupplierActionState,
  formData?: FormData,
): Promise<SupplierActionState> {
  const access = await requireAccess(slug, "manage_suppliers");
  if ("error" in access) return { error: access.error };
  const base = { tenantId: access.tenant.id, actorUserId: access.ctx.userId, id: supplierId };
  try {
    if (active) await reactivateSupplier(base);
    else await deactivateSupplier({ ...base, reason: formData ? text(formData, "reason") : "" });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/suppliers`);
  revalidatePath(`/t/${slug}/suppliers/${supplierId}`);
  return { ok: active ? "Proveedor reactivado" : "Proveedor dado de baja" };
}

export async function linkPersonAction(
  slug: string,
  supplierId: string,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireAccess(slug, "manage_suppliers");
  if ("error" in access) return { error: access.error };
  const personId = text(formData, "personId");
  if (!personId) return { error: "Elegí una persona" };
  try {
    await linkPersonToSupplier({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, supplierId, personId });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/suppliers/${supplierId}`);
  return { ok: "Persona vinculada" };
}

export async function unlinkPersonAction(
  slug: string,
  supplierId: string,
  personId: string,
): Promise<SupplierActionState> {
  const access = await requireAccess(slug, "manage_suppliers");
  if ("error" in access) return { error: access.error };
  try {
    await unlinkPersonFromSupplier({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, supplierId, personId });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/suppliers/${supplierId}`);
  return { ok: "Persona desvinculada" };
}

// ─── Importación ───────────────────────────────────────────────────────────

export type SupplierImportPreviewView = {
  counts: { create: number; exists: number };
  errors: SupplierCsvError[];
  totalRows: number;
  items: { line: number; name: string; taxId: string | null; type: SupplierTypeValue; criticality: SupplierCriticalityValue; action: "create" | "exists" }[];
};

export type SupplierImportState = {
  error?: string;
  preview?: SupplierImportPreviewView;
  done?: { created: number; existing: number; errors: number };
};

function checkCsv(csv: string): string | null {
  if (!csv.trim()) return "Elegí un archivo CSV con los proveedores";
  if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) return "El archivo supera el máximo de 2 MB";
  return null;
}

export async function previewSupplierImportAction(slug: string, csv: string): Promise<SupplierImportState> {
  const access = await requireAccess(slug, "manage_suppliers");
  if ("error" in access) return { error: access.error };
  const invalid = checkCsv(csv);
  if (invalid) return { error: invalid };
  try {
    const { plan, errors, totalRows } = await previewSupplierImport(access.tenant.id, csv);
    return {
      preview: {
        counts: plan.counts,
        errors,
        totalRows,
        items: plan.items.map((i) => ({
          line: i.row.line,
          name: i.row.legalName,
          taxId: i.row.taxId,
          type: i.row.type,
          criticality: i.row.criticality,
          action: i.action,
        })),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function applySupplierImportAction(slug: string, csv: string): Promise<SupplierImportState> {
  const access = await requireAccess(slug, "manage_suppliers");
  if ("error" in access) return { error: access.error };
  const invalid = checkCsv(csv);
  if (invalid) return { error: invalid };
  try {
    const done = await applySupplierImport({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, csv });
    revalidatePath(`/t/${slug}/suppliers`);
    return { done };
  } catch (error) {
    return fail(error);
  }
}

/** La vista imprimible también queda registrada como exportación. Alcanza con poder ver la lista. */
export async function recordPrintAction(slug: string): Promise<void> {
  const ctx = await getAppSessionContext();
  const tenant = await getTenantBySlug(slug);
  if (!ctx || !tenant) return;
  await requireModuleEnabled(tenant.id, "suppliers");
  if (!ctx.isPlatformSuperuser && !(await getMembership(ctx.userId, tenant.id))) return;
  const list = await getApprovedList(tenant.id);
  await recordApprovedListExport({
    tenantId: tenant.id,
    actorUserId: ctx.userId,
    count: list.entries.length,
    excluded: list.excludedForDocs,
    format: "print",
  });
}
