"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";
import {
  AuditGateError,
  approveProgram,
  createAudit,
  saveAuditPlan,
  saveProgram,
  transitionAudit,
} from "@/lib/audits";
import type {
  AuditItemResult,
  AuditMode,
  AuditStandard,
  AuditStatus,
} from "@/domain/audits/types";
import { canExecuteAudit } from "@/domain/audits/checklist";
import {
  addCustomQuestion,
  isAuditTeamMember,
  recordItemResult,
  removeChecklistItem,
  setRequirementItems,
  uploadAuditEvidence,
} from "@/lib/audit-checklist";

export type AuditActionState = { error?: string; issues?: string[]; ok?: string };

const STANDARDS: AuditStandard[] = ["ISO9001", "ISO14001", "ISO45001"];
const MODES: AuditMode[] = ["onsite", "remote", "hybrid"];

async function requirePermission(slug: string, action: AuthzAction) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!canTenantRole(membership?.role, action, { isPlatformSuperuser: ctx.isPlatformSuperuser })) {
    return { error: "Tu rol no tiene permiso para esta acción" } as const;
  }
  return { ctx, tenant } as const;
}

function toState(error: unknown, fallback: string): AuditActionState {
  if (error instanceof AuditGateError) return { issues: error.issues };
  return { error: error instanceof Error ? error.message : fallback };
}

function parseDate(raw: FormDataEntryValue | null): Date {
  return new Date(String(raw ?? ""));
}

export async function saveProgramAction(
  slug: string,
  year: number,
  _prev: AuditActionState,
  formData: FormData,
): Promise<AuditActionState> {
  const gate = await requirePermission(slug, "approve_audit_program");
  if ("error" in gate) return { error: gate.error };
  try {
    await saveProgram({
      tenantId: gate.tenant.id,
      year,
      objectives: String(formData.get("objectives") ?? ""),
      frequencyRationale: String(formData.get("frequencyRationale") ?? ""),
    });
  } catch (e) {
    return toState(e, "No se pudo guardar el programa");
  }
  revalidatePath(`/t/${slug}/audits`);
  return { ok: "Programa guardado. Falta aprobarlo." };
}

export async function approveProgramAction(
  slug: string,
  year: number,
): Promise<AuditActionState> {
  const gate = await requirePermission(slug, "approve_audit_program");
  if ("error" in gate) return { error: gate.error };
  try {
    await approveProgram({ tenantId: gate.tenant.id, year, userId: gate.ctx.userId });
  } catch (e) {
    return toState(e, "No se pudo aprobar el programa");
  }
  revalidatePath(`/t/${slug}/audits`);
  return { ok: "Programa aprobado" };
}

export async function createAuditAction(
  slug: string,
  _prev: AuditActionState,
  formData: FormData,
): Promise<AuditActionState> {
  const gate = await requirePermission(slug, "plan_audits");
  if ("error" in gate) return { error: gate.error };
  let auditId: string;
  try {
    const audit = await createAudit({
      tenantId: gate.tenant.id,
      title: String(formData.get("title") ?? ""),
      plannedStart: parseDate(formData.get("plannedStart")),
      plannedEnd: parseDate(formData.get("plannedEnd")),
      createdByUserId: gate.ctx.userId,
    });
    auditId = audit.id;
  } catch (e) {
    return toState(e, "No se pudo crear la auditoría");
  }
  revalidatePath(`/t/${slug}/audits`);
  redirect(`/t/${slug}/audits/${auditId}`);
}

export async function saveAuditPlanAction(
  slug: string,
  auditId: string,
  _prev: AuditActionState,
  formData: FormData,
): Promise<AuditActionState> {
  const gate = await requirePermission(slug, "plan_audits");
  if ("error" in gate) return { error: gate.error };

  const areas = formData.getAll("auditeeArea").map(String);
  const auditeeUsers = formData.getAll("auditeeUserId").map(String);
  const mode = String(formData.get("mode") ?? "onsite") as AuditMode;

  try {
    await saveAuditPlan({
      tenantId: gate.tenant.id,
      auditId,
      plan: {
        title: String(formData.get("title") ?? ""),
        objective: String(formData.get("objective") ?? ""),
        scope: String(formData.get("scope") ?? ""),
        standards: formData
          .getAll("standards")
          .map(String)
          .filter((s): s is AuditStandard => STANDARDS.includes(s as AuditStandard)),
        plannedStart: parseDate(formData.get("plannedStart")),
        plannedEnd: parseDate(formData.get("plannedEnd")),
        mode: MODES.includes(mode) ? mode : "onsite",
        leadUserId: String(formData.get("leadUserId") ?? "") || null,
        auditorUserIds: formData.getAll("auditorUserIds").map(String).filter(Boolean),
        auditees: areas.map((area, i) => ({ area, userId: auditeeUsers[i] || null })),
        impartialityException: String(formData.get("impartialityException") ?? "") || null,
      },
    });
  } catch (e) {
    return toState(e, "No se pudo guardar el plan");
  }
  revalidatePath(`/t/${slug}/audits/${auditId}`);
  revalidatePath(`/t/${slug}/audits`);
  return { ok: "Plan guardado" };
}

export async function transitionAuditAction(
  slug: string,
  auditId: string,
  to: AuditStatus,
  _prev: AuditActionState,
  formData: FormData,
): Promise<AuditActionState> {
  const gate = await requirePermission(slug, "plan_audits");
  if ("error" in gate) return { error: gate.error };
  try {
    await transitionAudit({
      tenantId: gate.tenant.id,
      auditId,
      to,
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (e) {
    return toState(e, "No se pudo cambiar el estado");
  }
  revalidatePath(`/t/${slug}/audits/${auditId}`);
  revalidatePath(`/t/${slug}/audits`);
  return { ok: "Estado actualizado" };
}

// ─── Lista de verificación y ejecución (11b.3) ──────────────────────────────

/** Equipo auditor de esta auditoría, administrador de la empresa o superusuario. */
async function requireExecutor(slug: string, auditId: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  const allowed = canExecuteAudit({
    isTeamMember: await isAuditTeamMember(auditId, ctx.userId),
    isCompanyAdmin: membership?.role === "tenant_admin",
    isPlatformSuperuser: ctx.isPlatformSuperuser,
  });
  if (!allowed) return { error: "Solo el equipo auditor puede ejecutar esta auditoría" } as const;
  return { ctx, tenant } as const;
}

function revalidateAudit(slug: string, auditId: string) {
  revalidatePath(`/t/${slug}/audits/${auditId}`);
  revalidatePath(`/t/${slug}/audits`);
}

export async function setRequirementItemsAction(
  slug: string,
  auditId: string,
  _prev: AuditActionState,
  formData: FormData,
): Promise<AuditActionState> {
  const gate = await requirePermission(slug, "plan_audits");
  if ("error" in gate) return { error: gate.error };
  let count: number;
  try {
    count = await setRequirementItems({
      tenantId: gate.tenant.id,
      auditId,
      tenantRequirementIds: formData.getAll("requirementIds").map(String),
    });
  } catch (e) {
    return toState(e, "No se pudo guardar la lista");
  }
  revalidateAudit(slug, auditId);
  return { ok: `Lista actualizada: ${count} ítems del catálogo` };
}

export async function addCustomQuestionAction(
  slug: string,
  auditId: string,
  _prev: AuditActionState,
  formData: FormData,
): Promise<AuditActionState> {
  const gate = await requirePermission(slug, "plan_audits");
  if ("error" in gate) return { error: gate.error };
  try {
    await addCustomQuestion({
      tenantId: gate.tenant.id,
      auditId,
      question: String(formData.get("question") ?? ""),
    });
  } catch (e) {
    return toState(e, "No se pudo agregar la pregunta");
  }
  revalidateAudit(slug, auditId);
  return { ok: "Pregunta agregada" };
}

export async function removeChecklistItemAction(slug: string, auditId: string, itemId: string) {
  const gate = await requirePermission(slug, "plan_audits");
  if ("error" in gate) return;
  await removeChecklistItem({ tenantId: gate.tenant.id, auditId, itemId });
  revalidateAudit(slug, auditId);
}

export async function startAuditAction(
  slug: string,
  auditId: string,
  _prev: AuditActionState,
  formData: FormData,
): Promise<AuditActionState> {
  const gate = await requireExecutor(slug, auditId);
  if ("error" in gate) return { error: gate.error };
  try {
    await transitionAudit({
      tenantId: gate.tenant.id,
      auditId,
      to: "in_progress",
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (e) {
    return toState(e, "No se pudo iniciar la auditoría");
  }
  revalidateAudit(slug, auditId);
  return { ok: "Auditoría en curso" };
}

const RESULTS: AuditItemResult[] = [
  "pending",
  "conforming",
  "nc_major",
  "nc_minor",
  "observation",
  "improvement",
  "not_applicable",
];

export async function recordItemResultAction(
  slug: string,
  auditId: string,
  itemId: string,
  _prev: AuditActionState,
  formData: FormData,
): Promise<AuditActionState> {
  const gate = await requireExecutor(slug, auditId);
  if ("error" in gate) return { error: gate.error };
  const result = String(formData.get("result") ?? "") as AuditItemResult;
  if (!RESULTS.includes(result)) return { error: "Elegí un resultado" };
  try {
    await recordItemResult({
      tenantId: gate.tenant.id,
      auditId,
      itemId,
      result,
      evidence: String(formData.get("evidence") ?? ""),
      userId: gate.ctx.userId,
    });
  } catch (e) {
    return toState(e, "No se pudo registrar el resultado");
  }
  revalidateAudit(slug, auditId);
  return { ok: "Guardado" };
}

export async function uploadAuditEvidenceAction(
  slug: string,
  auditId: string,
  itemId: string,
  _prev: AuditActionState,
  formData: FormData,
): Promise<AuditActionState> {
  const gate = await requireExecutor(slug, auditId);
  if ("error" in gate) return { error: gate.error };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elegí un archivo" };
  try {
    await uploadAuditEvidence({
      tenantId: gate.tenant.id,
      auditId,
      itemId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      body: Buffer.from(await file.arrayBuffer()),
      uploadedById: gate.ctx.userId,
    });
  } catch (e) {
    return toState(e, "No se pudo adjuntar la evidencia");
  }
  revalidateAudit(slug, auditId);
  return { ok: "Evidencia adjuntada" };
}
