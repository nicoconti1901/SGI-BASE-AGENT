"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { prisma } from "@/lib/db";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";
import {
  FindingGateError,
  addFindingMeasure,
  cancelFinding,
  reopenFinding,
  rescheduleVerification,
  startFindingMeasure,
  verifyFinding,
} from "@/lib/finding-lifecycle";
import type { VerificationResult } from "@/domain/findings/lifecycle";
import type { MeasureKind } from "@/domain/findings/types";

export type LifecycleActionState = { error?: string; issues?: string[]; ok?: string };

async function session(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  const can = (action: AuthzAction) =>
    canTenantRole(membership?.role, action, { isPlatformSuperuser: ctx.isPlatformSuperuser });
  return { ctx, tenant, can } as const;
}

function toState(error: unknown, fallback: string): LifecycleActionState {
  if (error instanceof FindingGateError) return { issues: error.issues };
  return { error: error instanceof Error ? error.message : fallback };
}

function done(slug: string, findingId: string, ok: string): LifecycleActionState {
  revalidatePath(`/t/${slug}/findings/${findingId}`);
  revalidatePath(`/t/${slug}/findings`);
  return { ok };
}

/** Iniciar: el responsable de la medida o quien puede editar hallazgos. */
export async function startMeasureAction(
  slug: string,
  findingId: string,
  measureId: string,
): Promise<LifecycleActionState> {
  const s = await session(slug);
  if ("error" in s) return { error: s.error };
  const measure = await prisma.findingMeasure.findFirst({
    where: { id: measureId, tenantId: s.tenant.id, findingId },
    select: { ownerUserId: true },
  });
  if (!measure) return { error: "Medida no encontrada" };
  if (measure.ownerUserId !== s.ctx.userId && !s.can("write")) {
    return { error: "Solo el responsable de la medida puede iniciarla" };
  }
  try {
    await startFindingMeasure({ tenantId: s.tenant.id, measureId, actorUserId: s.ctx.userId });
  } catch (e) {
    return toState(e, "No se pudo iniciar la medida");
  }
  return done(slug, findingId, "Medida en curso");
}

export async function verifyFindingAction(
  slug: string,
  findingId: string,
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const s = await session(slug);
  if ("error" in s) return { error: s.error };
  if (!s.can("verify_findings")) {
    return { error: "Verifica la eficacia el administrador o un responsable de proceso" };
  }
  const raw = String(formData.get("result") ?? "");
  const result: VerificationResult | null =
    raw === "effective" || raw === "not_effective" ? raw : null;
  try {
    await verifyFinding({
      tenantId: s.tenant.id,
      findingId,
      actorUserId: s.ctx.userId,
      result,
      evidence: String(formData.get("evidence") ?? ""),
      independenceException: String(formData.get("independenceException") ?? "") || null,
      earlyReason: String(formData.get("earlyReason") ?? "") || null,
    });
  } catch (e) {
    return toState(e, "No se pudo registrar la verificación");
  }
  return done(
    slug,
    findingId,
    result === "effective" ? "Eficacia verificada: hallazgo cerrado" : "Registrado: hace falta una nueva medida correctiva",
  );
}

export async function rescheduleVerificationAction(
  slug: string,
  findingId: string,
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const s = await session(slug);
  if ("error" in s) return { error: s.error };
  if (!s.can("verify_findings")) return { error: "Tu rol no puede reprogramar la verificación" };
  try {
    await rescheduleVerification({
      tenantId: s.tenant.id,
      findingId,
      dueAt: new Date(String(formData.get("dueAt") ?? "")),
    });
  } catch (e) {
    return toState(e, "No se pudo reprogramar");
  }
  return done(slug, findingId, "Verificación reprogramada");
}

export async function cancelFindingAction(
  slug: string,
  findingId: string,
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const s = await session(slug);
  if ("error" in s) return { error: s.error };
  if (!s.can("cancel_findings")) return { error: "Solo el administrador de la empresa puede anular" };
  try {
    await cancelFinding({
      tenantId: s.tenant.id,
      findingId,
      actorUserId: s.ctx.userId,
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (e) {
    return toState(e, "No se pudo anular");
  }
  return done(slug, findingId, "Hallazgo anulado");
}

export async function reopenFindingAction(
  slug: string,
  findingId: string,
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const s = await session(slug);
  if ("error" in s) return { error: s.error };
  if (!s.can("cancel_findings")) return { error: "Solo el administrador de la empresa puede reabrir" };
  try {
    await reopenFinding({
      tenantId: s.tenant.id,
      findingId,
      actorUserId: s.ctx.userId,
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (e) {
    return toState(e, "No se pudo reabrir");
  }
  return done(slug, findingId, "Hallazgo reabierto: agregá una nueva medida correctiva");
}

export async function addMeasureAction(
  slug: string,
  findingId: string,
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const s = await session(slug);
  if ("error" in s) return { error: s.error };
  if (!s.can("write")) return { error: "Tu rol no puede agregar medidas" };
  const kind: MeasureKind = formData.get("kind") === "preventive" ? "preventive" : "corrective";
  const dueRaw = String(formData.get("dueAt") ?? "");
  try {
    await addFindingMeasure({
      tenantId: s.tenant.id,
      findingId,
      actorUserId: s.ctx.userId,
      measure: {
        kind,
        title: String(formData.get("title") ?? ""),
        ownerUserId: String(formData.get("ownerUserId") ?? ""),
        dueAt: dueRaw ? new Date(dueRaw) : null,
        linkedRootCause: formData.get("linkedRootCause") === "on",
      },
    });
  } catch (e) {
    return toState(e, "No se pudo agregar la medida");
  }
  return done(slug, findingId, "Medida agregada");
}
