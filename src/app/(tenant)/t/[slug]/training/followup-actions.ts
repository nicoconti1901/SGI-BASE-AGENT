"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canTenantRole } from "@/domain/identity/authz";
import { TrainingError } from "@/lib/training-config";
import { evaluateEffectiveness, setTrainingOwner, type EvaluationResolution } from "@/lib/training-followup";
import { planSession, reschedulePlannedSession } from "@/lib/training-plan";
import { voidSession } from "@/lib/training-records";
import type { EvaluationMethod, EvaluationStatus } from "@/domain/training/followup";

export type FollowupResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

type Permission = "record_training" | "manage_training";

/** Sesión + permiso + módulo activo. El permiso se verifica acá, no solo ocultando botones. */
async function gate(slug: string, permission: Permission) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { ok: false, error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  if (!canTenantRole(membership?.role, permission, opts)) {
    return { ok: false, error: "Tu rol no permite esta acción" } as const;
  }
  if (!(await getEnabledModulesCached(tenant.id)).has("training")) return { ok: false, error: "El módulo no está activo" } as const;
  return { ok: true, ctx, tenant, canManage: canTenantRole(membership?.role, "manage_training", opts) } as const;
}

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof TrainingError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
}

// ─── Eficacia ──────────────────────────────────────────────────────────────

export type EvaluationPayload = {
  kind: "session" | "record";
  id: string;
  status: EvaluationStatus;
  method: EvaluationMethod | null;
  note: string;
  exceptions: { recordId: string; status: EvaluationStatus; note?: string }[];
  resolution?: EvaluationResolution;
};

/** Evalúa la eficacia: cualquiera con `record_training` entra, pero solo el evaluador designado o `manage_training` guarda. */
export async function evaluateEffectivenessAction(
  slug: string,
  payload: EvaluationPayload,
): Promise<FollowupResult<{ notEffective: number; actionId: string | null; rescheduledTo: string | null }>> {
  const access = await gate(slug, "record_training");
  if (!access.ok) return access;
  try {
    const done = await evaluateEffectiveness({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      canManage: access.canManage,
      ...(payload.kind === "session" ? { sessionId: payload.id } : { recordId: payload.id }),
      status: payload.status,
      method: payload.method,
      note: payload.note,
      exceptions: payload.exceptions,
      resolution: payload.resolution,
    });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: true, notEffective: done.notEffective, actionId: done.actionId, rescheduledTo: done.rescheduledTo };
  } catch (error) {
    return failure(error);
  }
}

// ─── Responsable de avisos ─────────────────────────────────────────────────

export async function setTrainingOwnerAction(
  slug: string,
  _prev: { error?: string; ok?: string },
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const access = await gate(slug, "manage_training");
  if (!access.ok) return { error: access.error };
  try {
    const ownerUserId = String(formData.get("ownerUserId") ?? "") || null;
    await setTrainingOwner({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, ownerUserId });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: ownerUserId ? "Responsable guardado" : "Sin responsable: los avisos van a los administradores" };
  } catch (error) {
    const result = failure(error);
    return { error: result.error };
  }
}

// ─── Plan anual ────────────────────────────────────────────────────────────

export type PlanPayload = {
  courseId: string;
  plannedFor: string;
  siteId: string | null;
  level: "senior" | "middle" | "operational" | null;
  notes: string | null;
};

export async function planSessionAction(slug: string, payload: PlanPayload): Promise<FollowupResult> {
  const access = await gate(slug, "record_training");
  if (!access.ok) return access;
  try {
    await planSession({ ...payload, tenantId: access.tenant.id, actorUserId: access.ctx.userId });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function reschedulePlannedSessionAction(slug: string, sessionId: string, heldAt: string): Promise<FollowupResult> {
  const access = await gate(slug, "record_training");
  if (!access.ok) return access;
  try {
    await reschedulePlannedSession({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, sessionId, heldAt });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Sacar una sesión del plan (queda anulada con motivo, como cualquier sesión). */
export async function cancelPlannedSessionAction(slug: string, sessionId: string, reason: string): Promise<FollowupResult> {
  const access = await gate(slug, "manage_training");
  if (!access.ok) return access;
  try {
    await voidSession({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, sessionId, reason });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
