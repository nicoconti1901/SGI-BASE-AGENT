"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import {
  addIncidentFollowUp,
  addIncidentRecordToFinding,
  saveIncidentHealth,
  updateIncidentFact,
  type SafetyUser,
} from "@/lib/safety-stats";
import { isClassification } from "@/domain/safety-stats/types";
import { errorMessage, parseFactForm, parseHealthForm } from "@/app/(tenant)/t/[slug]/safety/form";

export type FichaActionState = { error?: string; ok?: string; warnings?: string[] };

async function safetyContext(slug: string): Promise<{ error: string } | { tenantId: string; actor: SafetyUser }> {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" };
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" };
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!membership && !ctx.isPlatformSuperuser) return { error: "Sin acceso" };
  if (!(await getEnabledModulesCached(tenant.id)).has("safety_stats")) return { error: "El módulo de accidentabilidad no está activo" };
  return {
    tenantId: tenant.id,
    actor: { userId: ctx.userId, role: membership?.role, isPlatformSuperuser: ctx.isPlatformSuperuser },
  };
}

function refresh(slug: string, findingId: string) {
  revalidatePath(`/t/${slug}/findings/${findingId}`);
  revalidatePath(`/t/${slug}/findings/${findingId}/edit`);
  revalidatePath(`/t/${slug}/safety`);
}

/** Completa la ficha de salud (persona, lesión, parte del cuerpo, n.° de ART). */
export async function saveHealthAction(
  slug: string,
  findingId: string,
  _prev: FichaActionState,
  formData: FormData,
): Promise<FichaActionState> {
  const auth = await safetyContext(slug);
  if ("error" in auth) return { error: auth.error };
  try {
    const { warnings } = await saveIncidentHealth({ tenantId: auth.tenantId, actor: auth.actor, findingId, health: parseHealthForm(formData) });
    refresh(slug, findingId);
    return { ok: "Ficha de salud guardada", warnings };
  } catch (error) {
    return { error: errorMessage(error, "No se pudo guardar la ficha de salud") };
  }
}

/** Corrige el hecho (fecha, sede, forma, agente…). */
export async function updateFactAction(
  slug: string,
  findingId: string,
  _prev: FichaActionState,
  formData: FormData,
): Promise<FichaActionState> {
  const auth = await safetyContext(slug);
  if ("error" in auth) return { error: auth.error };
  try {
    const fact = parseFactForm(formData);
    const { warnings } = await updateIncidentFact({ tenantId: auth.tenantId, actor: auth.actor, findingId, fact });
    refresh(slug, findingId);
    return { ok: "Hecho actualizado", warnings };
  } catch (error) {
    return { error: errorMessage(error, "No se pudo actualizar el hecho") };
  }
}

/** Actualiza los días perdidos o reclasifica el caso; queda en el historial. */
export async function addFollowUpAction(
  slug: string,
  findingId: string,
  _prev: FichaActionState,
  formData: FormData,
): Promise<FichaActionState> {
  const auth = await safetyContext(slug);
  if ("error" in auth) return { error: auth.error };
  try {
    const classification = String(formData.get("fact_classification") ?? "");
    if (!isClassification(classification)) return { error: "Elegí cuánto se perdió" };
    const pct = String(formData.get("fact_chargePct") ?? "").trim();
    const { warnings } = await addIncidentFollowUp({
      tenantId: auth.tenantId,
      actor: auth.actor,
      findingId,
      followUp: {
        classification,
        restrictedWork: formData.get("fact_restrictedWork") === "on",
        returnToWorkDate: String(formData.get("fact_returnToWorkDate") ?? "").trim() || null,
        chargePct: pct ? Number(pct.replace(",", ".")) : null,
        note: String(formData.get("note") ?? ""),
      },
    });
    refresh(slug, findingId);
    return { ok: "Seguimiento registrado", warnings };
  } catch (error) {
    return { error: errorMessage(error, "No se pudo registrar el seguimiento") };
  }
}

/** Agrega la ficha a un incidente que se dio de alta sin ella. */
export async function addFichaAction(
  slug: string,
  findingId: string,
  _prev: FichaActionState,
  formData: FormData,
): Promise<FichaActionState> {
  const auth = await safetyContext(slug);
  if ("error" in auth) return { error: auth.error };
  try {
    const { warnings } = await addIncidentRecordToFinding({ tenantId: auth.tenantId, actor: auth.actor, findingId, fact: parseFactForm(formData) });
    refresh(slug, findingId);
    return { ok: "Ficha de accidente registrada", warnings };
  } catch (error) {
    return { error: errorMessage(error, "No se pudo registrar la ficha") };
  }
}
