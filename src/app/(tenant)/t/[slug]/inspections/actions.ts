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
  correctInspectionAnswer,
  deleteInspectionPhoto,
  saveAnswer,
  saveInspectionMeta,
  startInspection,
  type AnswerPatch,
  type CorrectionPatch,
} from "@/lib/inspections";
import { InspectionError } from "@/lib/inspection-support";
import { scheduleSiteInspection, startSiteInspection, unscheduleSiteInspection } from "@/lib/inspection-sites";
import { prisma } from "@/lib/db";
import { completeAction } from "@/lib/actions";
import { uploadActionAttachment } from "@/lib/action-attachments";
import { getAssetType } from "@/domain/inspections/asset-types";

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

/** Empezar (o retomar) la inspección de la zona de obradores de una sede y abrir su pantalla. */
export async function startSiteInspectionAction(slug: string, siteId: string): Promise<void> {
  const access = await requireWriter(slug);
  if (!access.ok) redirect(`/t/${slug}/inspections?error=${encodeURIComponent(access.error)}`);
  let id: string;
  try {
    id = (await startSiteInspection({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, siteId })).id;
  } catch (error) {
    const message = error instanceof InspectionError ? error.message : "No se pudo empezar la inspección";
    if (!(error instanceof InspectionError)) console.error(error);
    redirect(`/t/${slug}/inspections/new?error=${encodeURIComponent(message)}`);
  }
  redirect(`/t/${slug}/inspections/${id}`);
}

/** Programar (o sacar del programa) la zona de obradores de una sede: lo hace quien gestiona activos. */
export async function setSiteScheduleAction(slug: string, siteId: string, schedule: boolean): Promise<void> {
  const access = await requireWriter(slug);
  const ctx = await getAppSessionContext();
  const membership = ctx && access.ok ? await getMembership(ctx.userId, access.tenant.id) : null;
  const allowed = access.ok && canTenantRole(membership?.role, "manage_assets", { isPlatformSuperuser: ctx?.isPlatformSuperuser });
  if (!access.ok || !allowed) redirect(`/t/${slug}/inspections/new?error=${encodeURIComponent(access.ok ? "Tu rol no permite programar inspecciones" : access.error)}`);
  try {
    const input = { tenantId: access.tenant.id, actorUserId: access.ctx.userId, siteId };
    if (schedule) await scheduleSiteInspection(input);
    else await unscheduleSiteInspection(input);
  } catch (error) {
    const message = error instanceof InspectionError ? error.message : "No se pudo guardar el programa";
    if (!(error instanceof InspectionError)) console.error(error);
    redirect(`/t/${slug}/inspections/new?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/t/${slug}/inspections`);
  redirect(`/t/${slug}/inspections/new`);
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
export async function closeInspectionAction(
  slug: string,
  inspectionId: string,
  options: { confirmLowerReadings?: boolean; followUp?: { ownerUserId?: string | null; dueAt?: string | null } } = {},
): Promise<CaptureResult> {
  const access = await requireWriter(slug);
  if (!access.ok) return { ok: false, error: access.error };
  try {
    await closeInspection({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      canEditOthers: access.canEditOthers,
      inspectionId,
      confirmLowerReadings: options.confirmLowerReadings,
      followUp: options.followUp,
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/t/${slug}/inspections`);
  return { ok: true };
}

/** Corrige una respuesta de una inspección cerrada (administrador o responsable de proceso), con motivo. */
export async function correctAnswerAction(slug: string, inspectionId: string, answerId: string, patch: CorrectionPatch, reason: string): Promise<CaptureResult> {
  const access = await requireWriter(slug);
  if (!access.ok) return { ok: false, error: access.error };
  if (!access.canEditOthers) return { ok: false, error: "Solo un administrador o un responsable de proceso puede corregir una inspección cerrada" };
  try {
    await correctInspectionAnswer({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, canRelease: access.canEditOthers, inspectionId, answerId, patch, reason });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/t/${slug}/inspections/${inspectionId}`);
  revalidatePath(`/t/${slug}/inspections`);
  return { ok: true };
}

/** La acción de seguimiento tiene que ser la de esta inspección y de esta empresa. */
async function requireFollowUp(tenantId: string, inspectionId: string) {
  const inspection = await prisma.inspection.findFirst({ where: { id: inspectionId, tenantId }, select: { actionId: true } });
  if (!inspection?.actionId) throw new InspectionError("Esta inspección no tiene una acción de seguimiento");
  return inspection.actionId;
}

/** Adjunta evidencia a la acción de seguimiento de la inspección. */
export async function uploadFollowUpEvidenceAction(slug: string, inspectionId: string, formData: FormData): Promise<CaptureResult> {
  const access = await requireWriter(slug);
  if (!access.ok) return { ok: false, error: access.error };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí un archivo" };
  try {
    const actionId = await requireFollowUp(access.tenant.id, inspectionId);
    await uploadActionAttachment({
      tenantId: access.tenant.id,
      actionId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      body: Buffer.from(await file.arrayBuffer()),
      uploadedById: access.ctx.userId,
    });
  } catch (error) {
    return error instanceof InspectionError ? failure(error) : { ok: false, error: error instanceof Error ? error.message : "No se pudo adjuntar" };
  }
  revalidatePath(`/t/${slug}/inspections/${inspectionId}`);
  return { ok: true };
}

/** Completa la acción de seguimiento (pide al menos una evidencia, como el resto de las acciones). */
export async function completeFollowUpAction(slug: string, inspectionId: string): Promise<CaptureResult> {
  const access = await requireWriter(slug);
  if (!access.ok) return { ok: false, error: access.error };
  try {
    const actionId = await requireFollowUp(access.tenant.id, inspectionId);
    await completeAction({ tenantId: access.tenant.id, actionId });
  } catch (error) {
    return error instanceof InspectionError ? failure(error) : { ok: false, error: error instanceof Error ? error.message : "No se pudo completar" };
  }
  revalidatePath(`/t/${slug}/inspections/${inspectionId}`);
  return { ok: true };
}

/** Empezar (o retomar) el control previo al uso de un activo (la plantilla corta del conductor u operador). */
export async function startPreUseInspectionAction(slug: string, assetId: string): Promise<void> {
  const access = await requireWriter(slug);
  if (!access.ok) redirect(`/t/${slug}/inspections?error=${encodeURIComponent(access.error)}`);
  let id: string;
  try {
    const asset = await prisma.asset.findFirst({ where: { id: assetId, tenantId: access.tenant.id }, select: { typeKey: true } });
    const templateKey = asset ? getAssetType(asset.typeKey).preUseTemplateKey : undefined;
    if (!templateKey) throw new InspectionError("Este activo no tiene control previo al uso");
    id = (await startInspection({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, assetId, templateKey })).id;
  } catch (error) {
    const message = error instanceof InspectionError ? error.message : "No se pudo empezar el control";
    if (!(error instanceof InspectionError)) console.error(error);
    redirect(`/t/${slug}/inspections/new?error=${encodeURIComponent(message)}`);
  }
  redirect(`/t/${slug}/inspections/${id}`);
}
