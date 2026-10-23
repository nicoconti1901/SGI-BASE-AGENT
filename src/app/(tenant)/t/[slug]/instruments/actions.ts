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
