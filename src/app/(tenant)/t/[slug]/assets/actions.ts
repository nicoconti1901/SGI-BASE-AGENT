"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AssetOwnership } from "@prisma/client";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";
import {
  applyAssetImport,
  createAsset,
  previewAssetImport,
  renewAssetDueDate,
  retireAsset,
  updateAsset,
  type AssetImportAction,
} from "@/lib/assets";
import { InspectionError } from "@/lib/inspection-support";
import { getAssetType, isAssetTypeKey } from "@/domain/inspections/asset-types";
import type { DueInput } from "@/domain/inspections/asset-types/resolve";
import type { AssetCsvIssue } from "@/domain/inspections/asset-types/csv";

export type AssetActionState = { error?: string; ok?: string };

const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function requireAccess(slug: string, action: AuthzAction) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!canTenantRole(membership?.role, action, { isPlatformSuperuser: ctx.isPlatformSuperuser })) {
    return { error: "Tu rol no tiene permiso para esta acción" } as const;
  }
  // Un módulo apagado no acepta acciones, aunque alguien conozca la URL.
  const enabled = await getEnabledModulesCached(tenant.id);
  if (!enabled.has("inspections") && !enabled.has("instruments")) return { error: "El módulo no está activo" } as const;
  return { ctx, tenant } as const;
}

function fail(error: unknown): AssetActionState {
  if (error instanceof InspectionError) return { error: error.message };
  console.error(error);
  return { error: "No se pudo guardar. Probá de nuevo." };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function attributesFrom(typeKey: string, formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of getAssetType(typeKey).fields) {
    const raw = text(formData, `attr_${field.key}`);
    if (field.type === "boolean") out[field.key] = formData.get(`attr_${field.key}`) === "on";
    else if (raw === "") continue;
    else if (field.type === "number") out[field.key] = Number(raw.replace(",", "."));
    else out[field.key] = raw;
  }
  return out;
}

function dueInputsFrom(typeKey: string, formData: FormData): DueInput[] {
  return Object.keys(getAssetType(typeKey).dueKindLabels).map((kind) => ({
    kind,
    lastDoneAt: text(formData, `due_${kind}_last`) || null,
    dueAt: text(formData, `due_${kind}_due`) || null,
  }));
}

const ownershipOf = (v: string): AssetOwnership => (v === "rented" || v === "contractor" ? v : "own");

/** Alta (`assetId` nulo) o edición de un activo. El alta lleva a su ficha. */
export async function saveAssetAction(
  slug: string,
  assetId: string | null,
  typeKey: string,
  _prev: AssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  const access = await requireAccess(slug, "manage_assets");
  if ("error" in access) return { error: access.error };
  if (!isAssetTypeKey(typeKey)) return { error: "Tipo de activo desconocido" };
  const common = {
    tenantId: access.tenant.id,
    actorUserId: access.ctx.userId,
    description: text(formData, "description"),
    siteId: text(formData, "siteId"),
    sector: text(formData, "sector") || null,
    ownership: ownershipOf(text(formData, "ownership")),
    contractorName: text(formData, "contractorName") || null,
    assignedPersonId: text(formData, "assignedPersonId") || null,
    attributes: attributesFrom(typeKey, formData),
  };
  let createdId: string | null = null;
  try {
    if (assetId) await updateAsset({ ...common, assetId });
    else createdId = (await createAsset({ ...common, typeKey, code: text(formData, "code"), dueDates: dueInputsFrom(typeKey, formData) })).id;
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/assets`);
  if (createdId) redirect(`/t/${slug}/assets/${createdId}`);
  revalidatePath(`/t/${slug}/assets/${assetId}`);
  return { ok: "Cambios guardados" };
}

export async function retireAssetAction(slug: string, assetId: string, _prev: AssetActionState, formData: FormData): Promise<AssetActionState> {
  const access = await requireAccess(slug, "manage_assets");
  if ("error" in access) return { error: access.error };
  try {
    await retireAsset({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, assetId, reason: text(formData, "reason") });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/assets`);
  revalidatePath(`/t/${slug}/assets/${assetId}`);
  return { ok: "Activo dado de baja" };
}

export async function renewDueDateAction(slug: string, assetId: string, kind: string, _prev: AssetActionState, formData: FormData): Promise<AssetActionState> {
  const access = await requireAccess(slug, "manage_assets");
  if ("error" in access) return { error: access.error };
  try {
    await renewAssetDueDate({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      assetId,
      kind,
      lastDoneAt: text(formData, "lastDoneAt") || null,
      dueAt: text(formData, "dueAt") || null,
      reference: text(formData, "reference") || null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/assets/${assetId}`);
  return { ok: "Vencimiento renovado" };
}

// ─── Importación ───────────────────────────────────────────────────────────

export type AssetImportPreviewView = {
  counts: Record<AssetImportAction, number>;
  errors: AssetCsvIssue[];
  items: { line: number; code: string; description: string; action: AssetImportAction; changes: string[]; reason?: string }[];
};

export type AssetImportState = {
  error?: string;
  preview?: AssetImportPreviewView;
  done?: { counts: Record<AssetImportAction, number>; errors: number };
};

function checkCsv(csv: string): string | null {
  if (!csv.trim()) return "Elegí un archivo CSV";
  if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) return "El archivo supera el máximo de 2 MB";
  return null;
}

export async function previewAssetImportAction(slug: string, typeKey: string, csv: string): Promise<AssetImportState> {
  const access = await requireAccess(slug, "import_assets");
  if ("error" in access) return { error: access.error };
  const invalid = checkCsv(csv);
  if (invalid) return { error: invalid };
  try {
    const { counts, errors, items } = await previewAssetImport(access.tenant.id, typeKey, csv);
    return { preview: { counts, errors, items } };
  } catch (error) {
    return fail(error);
  }
}

export async function applyAssetImportAction(slug: string, typeKey: string, csv: string): Promise<AssetImportState> {
  const access = await requireAccess(slug, "import_assets");
  if ("error" in access) return { error: access.error };
  const invalid = checkCsv(csv);
  if (invalid) return { error: invalid };
  try {
    const done = await applyAssetImport({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, typeKey, csv });
    revalidatePath(`/t/${slug}/assets`);
    return { done };
  } catch (error) {
    return fail(error);
  }
}
