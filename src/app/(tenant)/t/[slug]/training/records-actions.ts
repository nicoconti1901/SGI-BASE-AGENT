"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canTenantRole } from "@/domain/identity/authz";
import { TrainingError } from "@/lib/training-config";
import {
  addIndividualRecord,
  applyTrainingImport,
  listAttendeeCandidates,
  previewTrainingImport,
  registerSession,
  uploadTrainingAttachment,
  voidRecord,
  voidSession,
  type AttendeeInput,
} from "@/lib/training-records";
import type { TrainingImportAction } from "@/domain/training/import";

export type RecordResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

type Permission = "record_training" | "manage_training";

/** Sesión + permiso + módulo activo. El permiso se verifica acá, no solo ocultando botones. */
async function gate(slug: string, permission: Permission) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { ok: false, error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!canTenantRole(membership?.role, permission, { isPlatformSuperuser: ctx.isPlatformSuperuser })) {
    return { ok: false, error: permission === "manage_training" ? "Tu rol no permite anular registros" : "Tu rol no permite registrar capacitaciones" } as const;
  }
  if (!(await getEnabledModulesCached(tenant.id)).has("training")) return { ok: false, error: "El módulo no está activo" } as const;
  return { ok: true, ctx, tenant } as const;
}

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof TrainingError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
}

export type SessionPayload = {
  courseId: string;
  heldAt: string;
  siteId: string | null;
  level: "senior" | "middle" | "operational" | null;
  instructorKind: "internal" | "external";
  instructorName: string;
  providerName: string | null;
  hours: number | null;
  evaluatorUserId: string | null;
  notes: string | null;
  attendees: AttendeeInput[];
};

export async function registerSessionAction(slug: string, payload: SessionPayload): Promise<RecordResult<{ sessionId: string; records: number }>> {
  const access = await gate(slug, "record_training");
  if (!access.ok) return access;
  try {
    const done = await registerSession({ ...payload, tenantId: access.tenant.id, actorUserId: access.ctx.userId });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: true, ...done };
  } catch (error) {
    return failure(error);
  }
}

export async function searchAttendeesAction(slug: string, filter: { siteId?: string; positionId?: string; q?: string }) {
  const access = await gate(slug, "record_training");
  if (!access.ok) return [];
  return listAttendeeCandidates(access.tenant.id, filter);
}

export type IndividualPayload = {
  personId: string;
  courseId: string;
  completedAt: string;
  result: "passed" | "failed";
  score: number | null;
  validUntil: string | null;
  providerName: string | null;
  certificateNumber: string | null;
  notes: string | null;
  evaluatorUserId: string | null;
};

export async function addIndividualRecordAction(slug: string, payload: IndividualPayload): Promise<RecordResult<{ recordId: string }>> {
  const access = await gate(slug, "record_training");
  if (!access.ok) return access;
  try {
    const record = await addIndividualRecord({ ...payload, tenantId: access.tenant.id, actorUserId: access.ctx.userId });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: true, recordId: record.id };
  } catch (error) {
    return failure(error);
  }
}

/** La planilla firmada llega como archivo: `kind` dice si es de una sesión o de un registro. */
export async function uploadTrainingAttachmentAction(slug: string, kind: "session" | "record", ownerId: string, formData: FormData): Promise<RecordResult> {
  const access = await gate(slug, "record_training");
  if (!access.ok) return access;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí un archivo" };
  try {
    await uploadTrainingAttachment({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      target: kind === "session" ? { sessionId: ownerId } : { recordId: ownerId },
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      body: Buffer.from(await file.arrayBuffer()),
    });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function voidRecordAction(slug: string, recordId: string, reason: string): Promise<RecordResult> {
  const access = await gate(slug, "manage_training");
  if (!access.ok) return access;
  try {
    await voidRecord({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, recordId, reason });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function voidSessionAction(slug: string, sessionId: string, reason: string): Promise<RecordResult> {
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

// ─── Importación del histórico ─────────────────────────────────────────────

const MAX_CSV_CHARS = 2_000_000;

export type ImportPreviewView = {
  counts: Record<TrainingImportAction, number>;
  parseErrors: { line: number; field: string; message: string }[];
  items: { line: number; action: TrainingImportAction; employeeCode: string; courseRef: string; completedAt: string; message?: string }[];
};

export type ImportState = { error?: string; preview?: ImportPreviewView; done?: { counts: Record<TrainingImportAction, number>; errors: number } };

export async function previewTrainingImportAction(slug: string, csv: string): Promise<ImportState> {
  const access = await gate(slug, "record_training");
  if (!access.ok) return { error: access.error };
  if (csv.length > MAX_CSV_CHARS) return { error: "El archivo es muy grande (máximo 2 MB)" };
  try {
    const { plan, parseErrors } = await previewTrainingImport(access.tenant.id, csv);
    return {
      preview: {
        counts: plan.counts,
        parseErrors,
        items: plan.items
          .filter((i) => i.action !== "unchanged")
          .slice(0, 200)
          .map((i) => ({ line: i.line, action: i.action, employeeCode: i.row.employeeCode, courseRef: i.row.courseRef, completedAt: i.row.completedAt, message: i.message })),
      },
    };
  } catch (error) {
    return { error: failure(error).error };
  }
}

export async function applyTrainingImportAction(slug: string, csv: string): Promise<ImportState> {
  const access = await gate(slug, "record_training");
  if (!access.ok) return { error: access.error };
  if (csv.length > MAX_CSV_CHARS) return { error: "El archivo es muy grande (máximo 2 MB)" };
  try {
    const done = await applyTrainingImport({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, csv });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { done };
  } catch (error) {
    return { error: failure(error).error };
  }
}
