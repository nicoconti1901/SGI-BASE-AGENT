"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PersonEmployer } from "@prisma/client";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole, type AuthzAction } from "@/domain/identity/authz";
import {
  MasterDataError,
  applyRosterImport,
  createPerson,
  deactivatePerson,
  previewRosterImport,
  reactivatePerson,
  setPersonJobTasks,
  updatePerson,
  type PersonInput,
} from "@/lib/masterdata";
import { parseDateCell } from "@/domain/masterdata/roster";
import type { RosterAction, RosterPlan } from "@/domain/masterdata/roster";
import type { MasterDataEntity, RosterRowError } from "@/domain/masterdata/types";

export type PersonActionState = { error?: string; ok?: string };

const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function requireAccess(slug: string, action: AuthzAction) {
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

function fail(error: unknown): PersonActionState {
  if (error instanceof MasterDataError) return { error: error.message };
  console.error(error);
  return { error: "No se pudo guardar. Probá de nuevo." };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function personInput(formData: FormData): PersonInput | { error: string } {
  const hiredRaw = text(formData, "hiredAt").trim();
  let hiredAt: Date | null = null;
  if (hiredRaw) {
    const iso = parseDateCell(hiredRaw);
    if (!iso) return { error: "Fecha de ingreso inválida" };
    hiredAt = new Date(`${iso}T00:00:00.000Z`);
  }
  return {
    employeeCode: text(formData, "employeeCode"),
    name: text(formData, "name"),
    documentId: text(formData, "documentId") || null,
    userId: text(formData, "userId") || null,
    employer: (text(formData, "employer") === "contractor" ? "contractor" : "own") as PersonEmployer,
    contractorName: text(formData, "contractorName") || null,
    siteId: text(formData, "siteId"),
    extraSiteIds: formData.getAll("extraSiteIds").map(String),
    positionId: text(formData, "positionId"),
    hiredAt,
    jobTaskIds: formData.getAll("jobTaskIds").map(String),
  };
}

/** Alta (`personId` nulo) o edición de una persona. El alta lleva a su ficha. */
export async function savePersonAction(
  slug: string,
  personId: string | null,
  _prev: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const access = await requireAccess(slug, "manage_master_data");
  if ("error" in access) return { error: access.error };
  const input = personInput(formData);
  if ("error" in input) return { error: input.error };
  const base = { tenantId: access.tenant.id, actorUserId: access.ctx.userId };

  let createdId: string | null = null;
  try {
    if (personId) await updatePerson({ ...base, ...input, id: personId });
    else createdId = (await createPerson({ ...base, ...input })).id;
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/master-data/people`);
  if (createdId) redirect(`/t/${slug}/master-data/people/${createdId}`);
  return { ok: "Cambios guardados" };
}

/** El responsable de proceso también puede asignar tareas (no edita el resto de la ficha). */
export async function savePersonTasksAction(
  slug: string,
  personId: string,
  _prev: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const access = await requireAccess(slug, "assign_job_tasks");
  if ("error" in access) return { error: access.error };
  try {
    await setPersonJobTasks({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      personId,
      jobTaskIds: formData.getAll("jobTaskIds").map(String),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/master-data/people/${personId}`);
  return { ok: "Tareas actualizadas" };
}

export async function setPersonActiveAction(
  slug: string,
  personId: string,
  active: boolean,
  _prev: PersonActionState,
  formData?: FormData,
): Promise<PersonActionState> {
  const access = await requireAccess(slug, "manage_master_data");
  if ("error" in access) return { error: access.error };
  const base = { tenantId: access.tenant.id, actorUserId: access.ctx.userId, id: personId };
  try {
    if (active) await reactivatePerson(base);
    else await deactivatePerson({ ...base, reason: formData ? text(formData, "reason").trim() || undefined : undefined });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/master-data/people`);
  revalidatePath(`/t/${slug}/master-data/people/${personId}`);
  return { ok: active ? "Persona reactivada" : "Persona dada de baja" };
}

// ─── Importación ───────────────────────────────────────────────────────────

export type RosterPreviewView = {
  counts: Record<RosterAction, number>;
  toCreate: RosterPlan["toCreate"];
  errors: RosterRowError[];
  inactiveReferenced: string[];
  items: { line: number; code: string; name: string; action: RosterAction; changes: string[]; reason?: string }[];
};

export type RosterState = {
  error?: string;
  preview?: RosterPreviewView;
  done?: { counts: Record<RosterAction, number>; created: Record<MasterDataEntity, string[]>; errors: number };
};

function checkCsv(csv: string): string | null {
  if (!csv.trim()) return "Elegí un archivo CSV con la nómina";
  if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) return "El archivo supera el máximo de 2 MB";
  return null;
}

export async function previewRosterAction(slug: string, csv: string): Promise<RosterState> {
  const access = await requireAccess(slug, "manage_master_data");
  if ("error" in access) return { error: access.error };
  const invalid = checkCsv(csv);
  if (invalid) return { error: invalid };
  try {
    const { plan, errors, inactiveReferenced } = await previewRosterImport(access.tenant.id, csv);
    return {
      preview: {
        counts: plan.counts,
        toCreate: plan.toCreate,
        errors,
        inactiveReferenced,
        items: plan.items.map((i) => ({
          line: i.row.line,
          code: i.row.employeeCode,
          name: i.row.name,
          action: i.action,
          changes: i.changes,
          reason: i.reason,
        })),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function applyRosterAction(slug: string, csv: string, allowCreateCatalog: boolean): Promise<RosterState> {
  const access = await requireAccess(slug, "manage_master_data");
  if ("error" in access) return { error: access.error };
  const invalid = checkCsv(csv);
  if (invalid) return { error: invalid };
  try {
    const result = await applyRosterImport({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      csv,
      allowCreateCatalog,
    });
    revalidatePath(`/t/${slug}/master-data`, "layout");
    return { done: { counts: result.counts, created: result.created, errors: result.errors.length } };
  } catch (error) {
    return fail(error);
  }
}
