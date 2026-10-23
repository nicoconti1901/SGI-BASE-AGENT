"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import {
  TrainingError,
  applyRequirementChanges,
  createCourse,
  deactivateCourse,
  importSuggestedCourses,
  previewRequirementImpact,
  reactivateCourse,
  recalculateCourseValidity,
  recordMatrixReview,
  updateCourse,
  type ImpactRow,
} from "@/lib/training-config";
import {
  COURSE_CATEGORIES,
  COURSE_MODALITIES,
  COURSE_STANDARDS,
  type CourseCategoryValue,
  type CourseModalityValue,
} from "@/domain/training/courses";
import { MATRIX_MAX_CHANGES, type MatrixChange } from "@/domain/training/matrix";
import { reconcileSafely } from "@/lib/training-followup";

export type TrainingActionState = { error?: string; ok?: string };

/** Quien configura cursos y matriz (`manage_training`). El permiso se verifica acá, no solo en la pantalla. */
async function requireManager(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!canTenantRole(membership?.role, "manage_training", { isPlatformSuperuser: ctx.isPlatformSuperuser })) {
    return { error: "Tu rol no tiene permiso para configurar capacitaciones" } as const;
  }
  return { ctx, tenant } as const;
}

function fail(error: unknown): { error: string } {
  if (error instanceof TrainingError) return { error: error.message };
  console.error(error);
  return { error: "No se pudo guardar. Probá de nuevo." };
}

function numberOrNull(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Alta (`id` nulo) o edición de un curso. */
export async function saveCourseAction(
  slug: string,
  id: string | null,
  _prev: TrainingActionState,
  formData: FormData,
): Promise<TrainingActionState> {
  const access = await requireManager(slug);
  if ("error" in access) return { error: access.error };
  const { ctx, tenant } = access;

  const category = String(formData.get("category") ?? "other");
  const modality = String(formData.get("modality") ?? "in_person");
  const draft = {
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    category: (COURSE_CATEGORIES as readonly string[]).includes(category) ? (category as CourseCategoryValue) : "other",
    modality: (COURSE_MODALITIES as readonly string[]).includes(modality) ? (modality as CourseModalityValue) : "in_person",
    standards: COURSE_STANDARDS.filter((s) => formData.getAll("standards").includes(s)),
    defaultHours: numberOrNull(formData.get("defaultHours")),
    validityMonths: numberOrNull(formData.get("validityMonths")),
    reminderDays: numberOrNull(formData.get("reminderDays")) ?? 30,
    requiresEffectiveness: formData.get("requiresEffectiveness") === "on",
    effectivenessDays: numberOrNull(formData.get("effectivenessDays")) ?? 90,
    legalBasis: String(formData.get("legalBasis") ?? ""),
    defaultProvider: String(formData.get("defaultProvider") ?? ""),
  };
  if ([draft.defaultHours, draft.validityMonths, draft.reminderDays, draft.effectivenessDays].some((n) => Number.isNaN(n))) {
    return { error: "Revisá los números: tienen que ser valores válidos" };
  }

  try {
    const base = { tenantId: tenant.id, actorUserId: ctx.userId };
    if (id) await updateCourse({ ...base, id, draft });
    else await createCourse({ ...base, draft });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/training`, "layout");
  return { ok: id ? "Cambios guardados" : "Curso registrado" };
}

export async function setCourseActiveAction(
  slug: string,
  id: string,
  active: boolean,
  ..._rest: [TrainingActionState, FormData?]
): Promise<TrainingActionState> {
  const access = await requireManager(slug);
  if ("error" in access) return { error: access.error };
  const { ctx, tenant } = access;
  try {
    const input = { tenantId: tenant.id, actorUserId: ctx.userId, id };
    if (active) await reactivateCourse(input);
    else await deactivateCourse(input);
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/training`, "layout");
  return { ok: active ? "Curso reactivado" : "Curso dado de baja" };
}

/** Acción explícita: reescribe los vencimientos de los registros con la vigencia actual del curso. */
export async function recalculateCourseValidityAction(
  slug: string,
  id: string,
  ..._rest: [TrainingActionState, FormData?]
): Promise<TrainingActionState> {
  const access = await requireManager(slug);
  if ("error" in access) return { error: access.error };
  const { ctx, tenant } = access;
  try {
    const { updated } = await recalculateCourseValidity({ tenantId: tenant.id, actorUserId: ctx.userId, courseId: id });
    if (updated > 0) await reconcileSafely(tenant.id, { silent: true, onlyPeople: true });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: updated === 0 ? "No había vencimientos para actualizar" : `Se actualizaron ${updated} registro(s)` };
  } catch (error) {
    return fail(error);
  }
}

export async function importSuggestedCoursesAction(
  slug: string,
  _prev: TrainingActionState,
  formData: FormData,
): Promise<TrainingActionState> {
  const access = await requireManager(slug);
  if ("error" in access) return { error: access.error };
  const { ctx, tenant } = access;
  try {
    const keys = formData.getAll("key").map(String);
    const { created } = await importSuggestedCourses({ tenantId: tenant.id, actorUserId: ctx.userId, keys });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: created.length === 1 ? "Se importó 1 curso" : `Se importaron ${created.length} cursos` };
  } catch (error) {
    return fail(error);
  }
}

function sanitizeChanges(changes: MatrixChange[]): MatrixChange[] {
  return changes.slice(0, MATRIX_MAX_CHANGES).map((c) => ({
    targetKind: c.targetKind,
    targetId: c.targetId,
    courseId: String(c.courseId),
    state: c.state,
    graceDays: Number(c.graceDays),
  }));
}

/** Vista previa del impacto de los cambios de la matriz. No escribe nada. */
export async function previewRequirementImpactAction(
  slug: string,
  changes: MatrixChange[],
): Promise<{ error: string } | { impact: ImpactRow[] }> {
  const access = await requireManager(slug);
  if ("error" in access) return { error: access.error ?? "Sin permiso" };
  try {
    return { impact: await previewRequirementImpact({ tenantId: access.tenant.id, changes: sanitizeChanges(changes) }) };
  } catch (error) {
    return fail(error);
  }
}

export async function saveRequirementsAction(slug: string, changes: MatrixChange[]): Promise<TrainingActionState> {
  const access = await requireManager(slug);
  if ("error" in access) return { error: access.error };
  const { ctx, tenant } = access;
  try {
    const r = await applyRequirementChanges({ tenantId: tenant.id, actorUserId: ctx.userId, changes: sanitizeChanges(changes) });
    // Requisitos nuevos en lote: lo que ya estaba vencido o faltante no avisa, solo las transiciones posteriores.
    await reconcileSafely(tenant.id, { silent: true, onlyPeople: true });
    revalidatePath(`/t/${slug}/training`, "layout");
    return { ok: `Matriz guardada: ${r.created} alta(s), ${r.updated} cambio(s), ${r.removed} baja(s)` };
  } catch (error) {
    return fail(error);
  }
}

export async function recordMatrixReviewAction(
  slug: string,
  _prev: TrainingActionState,
  formData: FormData,
): Promise<TrainingActionState> {
  const access = await requireManager(slug);
  if ("error" in access) return { error: access.error };
  const { ctx, tenant } = access;
  try {
    await recordMatrixReview({ tenantId: tenant.id, actorUserId: ctx.userId, note: String(formData.get("note") ?? "") });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/training`, "layout");
  return { ok: "Revisión registrada" };
}
