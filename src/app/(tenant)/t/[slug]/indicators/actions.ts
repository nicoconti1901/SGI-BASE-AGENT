"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import {
  ObjectiveGateError,
  closeObjective,
  createIndicator,
  createObjective,
  setIndicatorActive,
  updateIndicator,
  updateObjective,
  type IndicatorDraft,
  type ObjectiveDraft,
} from "@/lib/objectives";
import {
  canLoadIndicator,
  correctMeasurement,
  createFindingFromMeasurement,
  recordMeasurement,
} from "@/lib/measurements";
import type { AuditStandard } from "@/domain/audits/types";
import type {
  IndicatorDirection,
  IndicatorFrequency,
  IndicatorKind,
} from "@/domain/indicators/types";

export type IndicatorActionState = { error?: string; issues?: string[]; ok?: string };

const STANDARDS: AuditStandard[] = ["ISO9001", "ISO14001", "ISO45001"];
const DIRECTIONS: IndicatorDirection[] = ["higher_better", "lower_better"];
const FREQUENCIES: IndicatorFrequency[] = ["monthly", "quarterly", "semiannual", "annual"];
const KINDS: IndicatorKind[] = ["leading", "lagging"];

async function requireManager(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  if (
    !canTenantRole(membership?.role, "manage_objectives", { isPlatformSuperuser: ctx.isPlatformSuperuser })
  ) {
    return { error: "Tu rol no tiene permiso para esta acción" } as const;
  }
  return { ctx, tenant } as const;
}

function toState(error: unknown, fallback: string): IndicatorActionState {
  if (error instanceof ObjectiveGateError) return { issues: error.issues };
  return { error: error instanceof Error ? error.message : fallback };
}

function pick<T extends string>(raw: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  const value = String(raw ?? "") as T;
  return allowed.includes(value) ? value : fallback;
}

function parseNumber(raw: FormDataEntryValue | null): number {
  const text = String(raw ?? "").trim().replace(",", ".");
  return text === "" ? Number.NaN : Number(text);
}

function objectiveDraft(formData: FormData): ObjectiveDraft {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    standards: formData
      .getAll("standards")
      .map(String)
      .filter((s): s is AuditStandard => STANDARDS.includes(s as AuditStandard)),
    ownerUserId: String(formData.get("ownerUserId") ?? ""),
    dueDate: new Date(String(formData.get("dueDate") ?? "")),
    plan: String(formData.get("plan") ?? ""),
  };
}

function indicatorDraft(formData: FormData): IndicatorDraft {
  const alert = parseNumber(formData.get("alertThreshold"));
  return {
    name: String(formData.get("name") ?? ""),
    formula: String(formData.get("formula") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    direction: pick(formData.get("direction"), DIRECTIONS, "higher_better"),
    target: parseNumber(formData.get("target")),
    alertThreshold: Number.isNaN(alert) ? null : alert,
    frequency: pick(formData.get("frequency"), FREQUENCIES, "monthly"),
    kind: pick(formData.get("kind"), KINDS, "lagging"),
    ownerUserId: String(formData.get("ownerUserId") ?? ""),
  };
}

function revalidateObjective(slug: string, objectiveId: string) {
  revalidatePath(`/t/${slug}/indicators/${objectiveId}`);
  revalidatePath(`/t/${slug}/indicators`);
}

export async function createObjectiveAction(
  slug: string,
  _prev: IndicatorActionState,
  formData: FormData,
): Promise<IndicatorActionState> {
  const gate = await requireManager(slug);
  if ("error" in gate) return { error: gate.error };
  let objectiveId: string;
  try {
    const objective = await createObjective({
      tenantId: gate.tenant.id,
      createdByUserId: gate.ctx.userId,
      draft: objectiveDraft(formData),
    });
    objectiveId = objective.id;
  } catch (e) {
    return toState(e, "No se pudo crear el objetivo");
  }
  revalidatePath(`/t/${slug}/indicators`);
  redirect(`/t/${slug}/indicators/${objectiveId}`);
}

export async function updateObjectiveAction(
  slug: string,
  objectiveId: string,
  _prev: IndicatorActionState,
  formData: FormData,
): Promise<IndicatorActionState> {
  const gate = await requireManager(slug);
  if ("error" in gate) return { error: gate.error };
  try {
    await updateObjective({ tenantId: gate.tenant.id, objectiveId, draft: objectiveDraft(formData) });
  } catch (e) {
    return toState(e, "No se pudo guardar el objetivo");
  }
  revalidateObjective(slug, objectiveId);
  return { ok: "Objetivo guardado" };
}

export async function closeObjectiveAction(
  slug: string,
  objectiveId: string,
  _prev: IndicatorActionState,
  formData: FormData,
): Promise<IndicatorActionState> {
  const gate = await requireManager(slug);
  if ("error" in gate) return { error: gate.error };
  const result = pick(formData.get("result"), ["achieved", "not_achieved", "cancelled"] as const, "achieved");
  try {
    await closeObjective({
      tenantId: gate.tenant.id,
      objectiveId,
      result,
      note: String(formData.get("note") ?? ""),
    });
  } catch (e) {
    return toState(e, "No se pudo cerrar el objetivo");
  }
  revalidateObjective(slug, objectiveId);
  return { ok: "Objetivo cerrado" };
}

export async function createIndicatorAction(
  slug: string,
  objectiveId: string,
  _prev: IndicatorActionState,
  formData: FormData,
): Promise<IndicatorActionState> {
  const gate = await requireManager(slug);
  if ("error" in gate) return { error: gate.error };
  try {
    await createIndicator({ tenantId: gate.tenant.id, objectiveId, draft: indicatorDraft(formData) });
  } catch (e) {
    return toState(e, "No se pudo crear el indicador");
  }
  revalidateObjective(slug, objectiveId);
  return { ok: "Indicador creado" };
}

export async function updateIndicatorAction(
  slug: string,
  objectiveId: string,
  indicatorId: string,
  _prev: IndicatorActionState,
  formData: FormData,
): Promise<IndicatorActionState> {
  const gate = await requireManager(slug);
  if ("error" in gate) return { error: gate.error };
  try {
    await updateIndicator({ tenantId: gate.tenant.id, indicatorId, draft: indicatorDraft(formData) });
  } catch (e) {
    return toState(e, "No se pudo guardar el indicador");
  }
  revalidateObjective(slug, objectiveId);
  return { ok: "Indicador guardado" };
}

export async function setIndicatorActiveAction(
  slug: string,
  objectiveId: string,
  indicatorId: string,
  active: boolean,
): Promise<IndicatorActionState> {
  const gate = await requireManager(slug);
  if ("error" in gate) return { error: gate.error };
  try {
    await setIndicatorActive({ tenantId: gate.tenant.id, indicatorId, active });
  } catch (e) {
    return toState(e, "No se pudo cambiar el indicador");
  }
  revalidateObjective(slug, objectiveId);
  return { ok: active ? "Indicador reactivado" : "Indicador desactivado" };
}

// ─── Carga por período (11c.3) ──────────────────────────────────────────────

/** Responsable del indicador (con permiso de escritura), administrador o responsable de proceso. */
async function requireLoader(slug: string, indicatorId: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  const opts = { isPlatformSuperuser: ctx.isPlatformSuperuser };
  const canManage = canTenantRole(membership?.role, "manage_objectives", opts);
  const canWrite = canTenantRole(membership?.role, "write", opts);
  const indicator = await prisma.indicator.findFirst({
    where: { id: indicatorId, tenantId: tenant.id },
    select: { ownerUserId: true },
  });
  if (!indicator) return { error: "Indicador no encontrado" } as const;
  if (!canManage && !(canWrite && canLoadIndicator({ userId: ctx.userId, ownerUserId: indicator.ownerUserId, canManage }))) {
    return { error: "Solo el responsable del indicador o un administrador puede cargar valores" } as const;
  }
  return { ctx, tenant } as const;
}

export async function recordMeasurementAction(
  slug: string,
  objectiveId: string,
  indicatorId: string,
  _prev: IndicatorActionState,
  formData: FormData,
): Promise<IndicatorActionState> {
  const gate = await requireLoader(slug, indicatorId);
  if ("error" in gate) return { error: gate.error };
  try {
    await recordMeasurement({
      tenantId: gate.tenant.id,
      indicatorId,
      userId: gate.ctx.userId,
      value: parseNumber(formData.get("value")),
      analysis: String(formData.get("analysis") ?? ""),
    });
  } catch (e) {
    return toState(e, "No se pudo cargar el valor");
  }
  revalidateIndicator(slug, objectiveId, indicatorId);
  return { ok: "Valor cargado" };
}

export async function correctMeasurementAction(
  slug: string,
  objectiveId: string,
  indicatorId: string,
  measurementId: string,
  _prev: IndicatorActionState,
  formData: FormData,
): Promise<IndicatorActionState> {
  const gate = await requireLoader(slug, indicatorId);
  if ("error" in gate) return { error: gate.error };
  try {
    await correctMeasurement({
      tenantId: gate.tenant.id,
      measurementId,
      userId: gate.ctx.userId,
      newValue: parseNumber(formData.get("value")),
      reason: String(formData.get("reason") ?? ""),
      analysis: String(formData.get("analysis") ?? ""),
    });
  } catch (e) {
    return toState(e, "No se pudo corregir el valor");
  }
  revalidateIndicator(slug, objectiveId, indicatorId);
  return { ok: "Valor corregido" };
}

export async function createFindingFromMeasurementAction(
  slug: string,
  objectiveId: string,
  indicatorId: string,
  measurementId: string,
): Promise<IndicatorActionState> {
  const gate = await requireLoader(slug, indicatorId);
  if ("error" in gate) return { error: gate.error };
  try {
    await createFindingFromMeasurement({
      tenantId: gate.tenant.id,
      measurementId,
      userId: gate.ctx.userId,
    });
  } catch (e) {
    return toState(e, "No se pudo crear el hallazgo");
  }
  revalidateIndicator(slug, objectiveId, indicatorId);
  revalidatePath(`/t/${slug}/findings`);
  return { ok: "Hallazgo creado como borrador" };
}

function revalidateIndicator(slug: string, objectiveId: string, indicatorId: string) {
  revalidatePath(`/t/${slug}/indicators/${objectiveId}/${indicatorId}`);
  revalidateObjective(slug, objectiveId);
}
