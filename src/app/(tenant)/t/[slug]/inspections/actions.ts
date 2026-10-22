"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canTenantRole } from "@/domain/identity/authz";
import {
  addInspectionPhoto,
  closeInspection,
  deleteInspectionPhoto,
  saveAnswer,
  saveInspectionMeta,
  startInspection,
  type AnswerPatch,
} from "@/lib/inspections";
import { InspectionError } from "@/lib/inspection-support";

export type CaptureResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; blockers?: { code: string; message: string; itemId?: string }[]; missingItemIds?: string[] };

/** Sesión + permiso de registrar inspecciones («write»). Un módulo apagado no acepta acciones. */
async function requireWriter(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { ok: false, error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  if (!canTenantRole(membership?.role, "write", opts)) return { ok: false, error: "Tu rol no permite registrar inspecciones" } as const;
  if (!(await getEnabledModulesCached(tenant.id)).has("inspections")) return { ok: false, error: "El módulo no está activo" } as const;
  return { ok: true, ctx, tenant, canEditOthers: canTenantRole(membership?.role, "release_assets", opts) } as const;
}

function failure(error: unknown): { ok: false; error: string; blockers?: never[]; missingItemIds?: string[] } {
  if (error instanceof InspectionError) {
    const details = error.details as { blockers?: never[]; missingItemIds?: string[] } | undefined;
    return { ok: false, error: error.message, ...(details?.blockers ? { blockers: details.blockers } : {}), ...(details?.missingItemIds ? { missingItemIds: details.missingItemIds } : {}) };
  }
  console.error(error);
  return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
}

/** Empezar (o retomar) la inspección de un activo y abrir su pantalla. */
export async function startInspectionAction(slug: string, assetId: string): Promise<void> {
  const access = await requireWriter(slug);
  if (!access.ok) redirect(`/t/${slug}/inspections?error=${encodeURIComponent(access.error)}`);
  let id: string;
  try {
    id = (await startInspection({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, assetId })).id;
  } catch (error) {
    const message = error instanceof InspectionError ? error.message : "No se pudo empezar la inspección";
    if (!(error instanceof InspectionError)) console.error(error);
    redirect(`/t/${slug}/inspections/new?error=${encodeURIComponent(message)}`);
  }
  redirect(`/t/${slug}/inspections/${id}`);
}

export async function saveAnswerAction(slug: string, inspectionId: string, itemId: string, patch: AnswerPatch): Promise<CaptureResult> {
  const access = await requireWriter(slug);
  if (!access.ok) return { ok: false, error: access.error };
  try {
    await saveAnswer({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, canEditOthers: access.canEditOthers, inspectionId, itemId, patch });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveMetaAction(
  slug: string,
  inspectionId: string,
  meta: { inspectedAt?: string; performedByPersonId?: string | null; notes?: string | null },
): Promise<CaptureResult> {
  const access = await requireWriter(slug);
  if (!access.ok) return { ok: false, error: access.error };
  try {
    await saveInspectionMeta({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, canEditOthers: access.canEditOthers, inspectionId, ...meta });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** La foto llega ya reducida a 1.600 px desde el celular. */
export async function uploadPhotoAction(slug: string, inspectionId: string, itemId: string, formData: FormData): Promise<CaptureResult<{ photo: { id: string; fileName: string } }>> {
  const access = await requireWriter(slug);
  if (!access.ok) return { ok: false, error: access.error };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No se recibió la foto" };
  try {
    const photo = await addInspectionPhoto({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      canEditOthers: access.canEditOthers,
      inspectionId,
      itemId,
      fileName: file.name || "foto.jpg",
      contentType: file.type || "image/jpeg",
      body: Buffer.from(await file.arrayBuffer()),
    });
    return { ok: true, photo };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePhotoAction(slug: string, inspectionId: string, attachmentId: string): Promise<CaptureResult> {
  const access = await requireWriter(slug);
  if (!access.ok) return { ok: false, error: access.error };
  try {
    await deleteInspectionPhoto({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, canEditOthers: access.canEditOthers, inspectionId, attachmentId });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Cierra y firma. Devuelve el resultado o lo que falta; al cerrar, la pantalla navega a la ficha. */
export async function closeInspectionAction(slug: string, inspectionId: string, options: { confirmLowerReadings?: boolean } = {}): Promise<CaptureResult> {
  const access = await requireWriter(slug);
  if (!access.ok) return { ok: false, error: access.error };
  try {
    await closeInspection({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      canEditOthers: access.canEditOthers,
      inspectionId,
      confirmLowerReadings: options.confirmLowerReadings,
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/t/${slug}/inspections`);
  return { ok: true };
}
