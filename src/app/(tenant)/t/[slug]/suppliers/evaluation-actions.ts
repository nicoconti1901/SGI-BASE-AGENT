"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveEvaluation, voidEvaluation, type EvaluationAnswer } from "@/lib/supplier-evaluations";
import { uploadSupplierDocument, voidSupplierDocument } from "@/lib/supplier-documents";
import { SupplierError } from "@/lib/suppliers";
import type { EvaluationKindValue } from "@/domain/suppliers/evaluation";
import type { EvaluationModeValue } from "@/domain/suppliers/types";
import {
  formDate,
  formText,
  requireSupplierAccess,
  supplierFailure,
  type SupplierActionState,
} from "@/app/(tenant)/t/[slug]/suppliers/guard";

/** Respuestas del formulario: un `criterionId` por criterio con su `score_<id>` («1» a «5» o «na») y `comment_<id>`. */
function readAnswers(formData: FormData): EvaluationAnswer[] {
  return formData.getAll("criterionId").map((value) => {
    const criterionId = String(value);
    const raw = formText(formData, `score_${criterionId}`).trim();
    if (!raw) throw new SupplierError("Falta la nota de un criterio");
    return {
      criterionId,
      score: raw === "na" ? null : Number(raw),
      comment: formText(formData, `comment_${criterionId}`),
    };
  });
}

/** Guarda la evaluación. El total y el resultado los calcula el servidor: acá solo se leen notas y comentarios. */
export async function saveEvaluationAction(
  slug: string,
  supplierId: string,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "evaluate_suppliers");
  if ("error" in access) return { error: access.error };
  let evaluationId: string;
  try {
    const planOwner = formText(formData, "planOwnerUserId");
    const planDue = formDate(formData, "planDueAt");
    const result = await saveEvaluation({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      supplierId,
      kind: formText(formData, "kind") as EvaluationKindValue,
      mode: formText(formData, "mode") as EvaluationModeValue,
      periodFrom: formDate(formData, "periodFrom"),
      periodTo: formDate(formData, "periodTo"),
      comment: formText(formData, "comment"),
      answers: readAnswers(formData),
      plan:
        planOwner && planDue
          ? { ownerUserId: planOwner, dueAt: planDue, title: formText(formData, "planTitle"), description: formText(formData, "planDescription") }
          : undefined,
    });
    evaluationId = result.evaluation.id;
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(`/t/${slug}/suppliers`);
  revalidatePath(`/t/${slug}/suppliers/${supplierId}`);
  redirect(`/t/${slug}/suppliers/${supplierId}?tab=evaluaciones&eval=${evaluationId}`);
}

export async function voidEvaluationAction(
  slug: string,
  supplierId: string,
  evaluationId: string,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "evaluate_suppliers");
  if ("error" in access) return { error: access.error };
  try {
    await voidEvaluation({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      supplierId,
      evaluationId,
      reason: formText(formData, "reason"),
    });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(`/t/${slug}/suppliers`);
  revalidatePath(`/t/${slug}/suppliers/${supplierId}`);
  return { ok: "Evaluación anulada" };
}

// ─── Documentos ────────────────────────────────────────────────────────────

export async function uploadDocumentAction(
  slug: string,
  supplierId: string,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "upload_supplier_documents");
  if ("error" in access) return { error: access.error };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elegí el archivo del documento" };
  const typeId = formText(formData, "typeId");
  if (!typeId) return { error: "Elegí qué documento es" };
  try {
    await uploadSupplierDocument({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      supplierId,
      typeId,
      issuedAt: formDate(formData, "issuedAt"),
      expiresAt: formDate(formData, "expiresAt"),
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      body: Buffer.from(await file.arrayBuffer()),
    });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(`/t/${slug}/suppliers`);
  revalidatePath(`/t/${slug}/suppliers/${supplierId}`);
  return { ok: "Documento cargado" };
}

export async function voidDocumentAction(
  slug: string,
  supplierId: string,
  documentId: string,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "manage_suppliers");
  if ("error" in access) return { error: access.error };
  try {
    await voidSupplierDocument({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      supplierId,
      documentId,
      reason: formText(formData, "reason"),
    });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(`/t/${slug}/suppliers`);
  revalidatePath(`/t/${slug}/suppliers/${supplierId}`);
  return { ok: "Documento anulado" };
}
