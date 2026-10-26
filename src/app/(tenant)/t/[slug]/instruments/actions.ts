"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";
import { prisma } from "@/lib/db";
import { retireAsset } from "@/lib/assets";
import { createInstrument, updateInstrument } from "@/lib/instruments";
import { InspectionError } from "@/lib/inspection-support";
import {
  closeCalibrationRecord,
  discardCalibrationDraft,
  registerInstrumentReturn,
  removeCalibrationCertificate,
  saveCalibrationDraft,
  sendInstrumentToCalibration,
  uploadCalibrationCertificate,
  voidCalibrationRecord,
  type PointDraft,
} from "@/lib/calibration-records";
import { INSTRUMENT_TYPE_KEY } from "@/domain/calibration/types";

export type InstrumentActionState = { error?: string; ok?: string };

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
  if (!(await getEnabledModulesCached(tenant.id)).has("instruments")) return { error: "El módulo no está activo" } as const;
  return { ctx, tenant } as const;
}

function fail(error: unknown): InstrumentActionState {
  if (error instanceof InspectionError) return { error: error.message };
  console.error(error);
  return { error: "No se pudo guardar. Probá de nuevo." };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const flag = (formData: FormData, key: string) => formData.get(key) === "on";
const intOrUndefined = (formData: FormData, key: string) => {
  const raw = text(formData, key);
  return raw === "" ? undefined : Number(raw.replace(",", "."));
};

/** Baja del equipo: no se borra, conserva su historial de calibraciones. */
export async function retireInstrumentAction(slug: string, assetId: string, _prev: InstrumentActionState, formData: FormData): Promise<InstrumentActionState> {
  const access = await requireAccess(slug, "manage_calibration");
  if ("error" in access) return { error: access.error };
  try {
    const asset = await prisma.asset.findFirst({ where: { id: assetId, tenantId: access.tenant.id, typeKey: INSTRUMENT_TYPE_KEY }, select: { id: true } });
    if (!asset) return { error: "Equipo no encontrado" };
    await retireAsset({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, assetId, reason: text(formData, "reason") });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/instruments`);
  revalidatePath(`/t/${slug}/instruments/${assetId}`);
  return { ok: "Equipo dado de baja" };
}

/** Los canales viajan como JSON desde el editor; lo que no se puede leer se descarta con un mensaje claro. */
function channelsFrom(formData: FormData): unknown {
  try {
    const parsed: unknown = JSON.parse(text(formData, "channels") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new InspectionError("No se pudieron leer los canales: volvé a cargarlos");
  }
}

/** Alta (`assetId` nulo) o edición de un equipo de medición con su configuración. El alta lleva a su ficha. */
export async function saveInstrumentAction(slug: string, assetId: string | null, _prev: InstrumentActionState, formData: FormData): Promise<InstrumentActionState> {
  const access = await requireAccess(slug, "manage_calibration");
  if ("error" in access) return { error: access.error };
  let createdId: string | null = null;
  try {
    const common = {
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      description: text(formData, "description"),
      siteId: text(formData, "siteId"),
      sector: text(formData, "sector") || null,
      assignedPersonId: text(formData, "assignedPersonId") || null,
      attributes: {
        brand: text(formData, "brand"),
        model: text(formData, "model"),
        serialNumber: text(formData, "serialNumber"),
        inServiceSince: text(formData, "inServiceSince"),
      },
      control: {
        magnitude: text(formData, "magnitude"),
        isReferenceStandard: flag(formData, "isReferenceStandard"),
        criticalUse: flag(formData, "criticalUse"),
        criticalUseReason: text(formData, "criticalUseReason"),
        requiresCalibration: flag(formData, "requiresCalibration"),
        calibrationIntervalMonths: intOrUndefined(formData, "calibrationIntervalMonths"),
        requiresVerification: flag(formData, "requiresVerification"),
        verificationIntervalMonths: intOrUndefined(formData, "verificationIntervalMonths"),
        intervalReason: text(formData, "intervalReason"),
        noControlReason: text(formData, "noControlReason"),
        decisionRule: text(formData, "decisionRule") || "guard_band",
        decisionRuleReason: text(formData, "decisionRuleReason"),
        alertLeadDays: intOrUndefined(formData, "alertLeadDays") ?? 30,
        channels: channelsFrom(formData),
      },
    };
    if (assetId) await updateInstrument({ ...common, assetId });
    else createdId = (await createInstrument({ ...common, code: text(formData, "code") })).id;
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/instruments`);
  if (createdId) redirect(`/t/${slug}/instruments/${createdId}`);
  revalidatePath(`/t/${slug}/instruments/${assetId}`);
  return { ok: "Cambios guardados" };
}

// ─── Calibraciones y verificaciones (16.3) ─────────────────────────────────

export type RecordActionState = InstrumentActionState & { recordId?: string };

type PointsPayload = { as_found?: unknown; as_left?: unknown };

function pointsFrom(formData: FormData): { asFound: PointDraft[]; asLeft: PointDraft[] } {
  try {
    const parsed = JSON.parse(text(formData, "points") || "{}") as PointsPayload;
    const rows = (list: unknown): PointDraft[] =>
      Array.isArray(list)
        ? list.map((p: Record<string, unknown>) => ({
            channelKey: String(p?.channelKey ?? ""),
            nominal: String(p?.nominal ?? ""),
            measured: String(p?.measured ?? ""),
            uncertainty: p?.uncertainty === undefined || p?.uncertainty === null ? null : String(p.uncertainty),
          }))
        : [];
    return { asFound: rows(parsed.as_found), asLeft: rows(parsed.as_left) };
  } catch {
    throw new InspectionError("No se pudieron leer los puntos: volvé a cargarlos");
  }
}

/**
 * Guarda el borrador (con los certificados que se adjuntaron) y, con «Cerrar», calcula el resultado y lo cierra.
 * Si el cierre falla, el borrador queda guardado y se devuelve su id para seguir sobre el mismo registro.
 */
export async function saveRecordAction(slug: string, assetId: string, recordId: string | null, _prev: RecordActionState, formData: FormData): Promise<RecordActionState> {
  const access = await requireAccess(slug, "write");
  if ("error" in access) return { error: access.error, recordId: recordId ?? undefined };
  const tenantId = access.tenant.id;
  const actorUserId = access.ctx.userId;
  let id: string | null = recordId ?? (text(formData, "recordId") || null);
  const isNew = recordId === null && id === null;
  const closing = text(formData, "intent") === "close";
  try {
    const { asFound, asLeft } = pointsFrom(formData);
    const statement = text(formData, "labStatement");
    const saved = await saveCalibrationDraft({
      tenantId,
      actorUserId,
      assetId,
      recordId: id,
      kind: text(formData, "kind"),
      performedAt: text(formData, "performedAt"),
      certificateNumber: text(formData, "certificateNumber"),
      certificateIssuedAt: text(formData, "certificateIssuedAt"),
      labName: text(formData, "labName"),
      traceability: text(formData, "traceability"),
      accreditationBody: text(formData, "accreditationBody"),
      accreditationNumber: text(formData, "accreditationNumber"),
      accreditationScopeCovers: flag(formData, "accreditationScopeCovers"),
      traceabilityBasis: text(formData, "traceabilityBasis"),
      referenceStandardAssetId: text(formData, "referenceStandardAssetId"),
      conditions: text(formData, "conditions"),
      adjusted: flag(formData, "adjusted"),
      basis: text(formData, "basis") === "certificate_statement" ? "certificate_statement" : "points",
      labStatement: statement === "conforme" || statement === "no_conforme" ? statement : null,
      labStatementSpec: text(formData, "labStatementSpec"),
      labDecisionRule: text(formData, "labDecisionRule"),
      coverageK: text(formData, "coverageK"),
      notes: text(formData, "notes"),
      asFoundPoints: asFound,
      asLeftPoints: asLeft,
    });
    id = saved.id;
    for (const file of formData.getAll("certificate")) {
      if (!(file instanceof File) || file.size === 0) continue;
      await uploadCalibrationCertificate({ tenantId, recordId: id, fileName: file.name, contentType: file.type, body: Buffer.from(await file.arrayBuffer()), uploadedById: actorUserId });
    }
    if (closing) await closeCalibrationRecord({ tenantId, actorUserId, recordId: id });
  } catch (error) {
    return { ...fail(error), recordId: id ?? undefined };
  }
  revalidatePath(`/t/${slug}/instruments`);
  revalidatePath(`/t/${slug}/instruments/${assetId}`);
  if (closing) redirect(`/t/${slug}/instruments/${assetId}`);
  if (isNew) redirect(`/t/${slug}/instruments/${assetId}/records/${id}`);
  revalidatePath(`/t/${slug}/instruments/${assetId}/records/${id}`);
  return { ok: "Borrador guardado", recordId: id ?? undefined };
}

export async function discardDraftAction(slug: string, assetId: string, recordId: string): Promise<InstrumentActionState> {
  const access = await requireAccess(slug, "write");
  if ("error" in access) return { error: access.error };
  try {
    await discardCalibrationDraft({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, recordId });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/instruments/${assetId}`);
  redirect(`/t/${slug}/instruments/${assetId}`);
}

export async function removeCertificateAction(slug: string, assetId: string, attachmentId: string): Promise<InstrumentActionState> {
  const access = await requireAccess(slug, "write");
  if ("error" in access) return { error: access.error };
  try {
    const { recordId } = await removeCalibrationCertificate({ tenantId: access.tenant.id, attachmentId });
    revalidatePath(`/t/${slug}/instruments/${assetId}/records/${recordId}`);
  } catch (error) {
    return fail(error);
  }
  return { ok: "Archivo quitado" };
}

export async function voidRecordAction(slug: string, assetId: string, recordId: string, _prev: InstrumentActionState, formData: FormData): Promise<InstrumentActionState> {
  const access = await requireAccess(slug, "manage_calibration");
  if ("error" in access) return { error: access.error };
  try {
    await voidCalibrationRecord({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, recordId, reason: text(formData, "reason") });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/instruments`);
  revalidatePath(`/t/${slug}/instruments/${assetId}`);
  return { ok: "Registro anulado" };
}

export async function sendToCalibrationAction(slug: string, assetId: string, _prev: InstrumentActionState, formData: FormData): Promise<InstrumentActionState> {
  const access = await requireAccess(slug, "write");
  if ("error" in access) return { error: access.error };
  try {
    await sendInstrumentToCalibration({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      assetId,
      sentAt: text(formData, "sentAt"),
      expectedReturnAt: text(formData, "expectedReturnAt"),
      labName: text(formData, "labName"),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/instruments`);
  revalidatePath(`/t/${slug}/instruments/${assetId}`);
  return { ok: "Equipo enviado a calibrar" };
}

export async function registerReturnAction(slug: string, assetId: string, _prev: InstrumentActionState, formData: FormData): Promise<InstrumentActionState> {
  const access = await requireAccess(slug, "write");
  if ("error" in access) return { error: access.error };
  try {
    await registerInstrumentReturn({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, assetId, returnedAt: text(formData, "returnedAt") });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/instruments`);
  revalidatePath(`/t/${slug}/instruments/${assetId}`);
  return { ok: "Regreso registrado" };
}
