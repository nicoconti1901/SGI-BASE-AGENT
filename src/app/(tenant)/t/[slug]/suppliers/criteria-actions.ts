"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  discardTemplateDraft,
  publishTemplateDraft,
  saveDocumentType,
  saveTemplateDraft,
  setDocumentTypeActive,
  startTemplateDraft,
} from "@/lib/supplier-criteria";
import { SupplierError } from "@/lib/suppliers";
import { CRITERION_PHASES, DOCUMENT_RECURRENCES, SUPPLIER_TYPES, type SupplierTypeValue } from "@/domain/suppliers/types";
import {
  formText,
  requireSupplierAccess,
  supplierFailure,
  type SupplierActionState,
} from "@/app/(tenant)/t/[slug]/suppliers/guard";

const criterionSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(1000),
  descriptor1: z.string().max(500),
  descriptor3: z.string().max(500),
  descriptor5: z.string().max(500),
  weight: z.number(),
  excluding: z.boolean(),
  allowNA: z.boolean(),
  phase: z.enum(CRITERION_PHASES),
  basic: z.boolean(),
});

const base = (slug: string) => `/t/${slug}/suppliers/criteria`;

export async function startDraftAction(slug: string, supplierType: SupplierTypeValue): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "manage_supplier_criteria");
  if ("error" in access) return { error: access.error };
  if (!SUPPLIER_TYPES.includes(supplierType)) return { error: "Tipo de proveedor inválido" };
  try {
    await startTemplateDraft({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, supplierType });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(base(slug));
  redirect(`${base(slug)}?tipo=${supplierType}&ver=borrador`);
}

/** Guarda el borrador y, si se pidió (`intent=publish`), lo publica. */
export async function saveDraftAction(
  slug: string,
  templateId: string,
  supplierType: SupplierTypeValue,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "manage_supplier_criteria");
  if ("error" in access) return { error: access.error };
  const tenantId = access.tenant.id;
  const actorUserId = access.ctx.userId;
  const publish = formText(formData, "intent") === "publish";
  try {
    let criteria;
    try {
      criteria = z.array(criterionSchema).parse(JSON.parse(formText(formData, "criteria") || "[]"));
    } catch {
      throw new SupplierError("No se pudieron leer los criterios. Recargá la página.");
    }
    await saveTemplateDraft({
      tenantId,
      actorUserId,
      templateId,
      approvedMin: Number(formText(formData, "approvedMin")),
      conditionalMin: Number(formText(formData, "conditionalMin")),
      changeNote: formText(formData, "changeNote"),
      criteria,
    });
    if (publish) await publishTemplateDraft({ tenantId, actorUserId, templateId });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(base(slug));
  if (publish) redirect(`${base(slug)}?tipo=${supplierType}&publicada=1`);
  return { ok: "Borrador guardado" };
}

export async function discardDraftAction(slug: string, templateId: string, supplierType: SupplierTypeValue): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "manage_supplier_criteria");
  if ("error" in access) return { error: access.error };
  try {
    await discardTemplateDraft({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, templateId });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(base(slug));
  redirect(`${base(slug)}?tipo=${supplierType}`);
}

// ─── Tipos de documento ────────────────────────────────────────────────────

export async function saveDocumentTypeAction(
  slug: string,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "manage_supplier_criteria");
  if ("error" in access) return { error: access.error };
  const months = formText(formData, "validityMonths").trim();
  const recurrence = formText(formData, "recurrence") || "none";
  try {
    if (!DOCUMENT_RECURRENCES.includes(recurrence as (typeof DOCUMENT_RECURRENCES)[number])) throw new SupplierError("La recurrencia no es válida");
    await saveDocumentType({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      id: formText(formData, "id") || undefined,
      name: formText(formData, "name"),
      appliesTo: formData.getAll("appliesTo").map(String) as SupplierTypeValue[],
      required: formData.get("required") === "on",
      blocksEnablement: formData.get("blocksEnablement") === "on",
      validityMonths: months ? Number(months) : null,
      recurrence: recurrence as (typeof DOCUMENT_RECURRENCES)[number],
      note: formText(formData, "note"),
    });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(base(slug));
  revalidatePath(`/t/${slug}/suppliers`);
  return { ok: "Tipo de documento guardado" };
}

export async function setDocumentTypeActiveAction(slug: string, id: string, active: boolean): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "manage_supplier_criteria");
  if ("error" in access) return { error: access.error };
  try {
    await setDocumentTypeActive({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, id, active });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(base(slug));
  revalidatePath(`/t/${slug}/suppliers`);
  return { ok: active ? "Tipo de documento reactivado" : "Tipo de documento desactivado" };
}
