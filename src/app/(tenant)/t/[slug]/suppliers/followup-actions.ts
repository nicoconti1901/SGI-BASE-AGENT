"use server";

import { revalidatePath } from "next/cache";
import { createSupplierFinding, recordCommunication } from "@/lib/supplier-followup";
import type { SupplierCommunicationChannelValue, SupplierCommunicationKindValue, SupplierFindingKindValue } from "@/domain/suppliers/findings";
import {
  formDate,
  formText,
  requireSupplierAccess,
  supplierFailure,
  type SupplierActionState,
} from "@/app/(tenant)/t/[slug]/suppliers/guard";

/**
 * Registra un hallazgo del proveedor. Sigue el permiso vigente para crear hallazgos (`write`): lo puede hacer
 * cualquiera que pueda cargar hallazgos, no solo quien administra proveedores.
 */
export async function createSupplierFindingAction(
  slug: string,
  supplierId: string,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "write");
  if ("error" in access) return { error: access.error };
  try {
    await createSupplierFinding({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      supplierId,
      kind: formText(formData, "kind") as SupplierFindingKindValue,
      title: formText(formData, "title"),
      description: formText(formData, "description"),
      detectedAt: formDate(formData, "detectedAt") ?? undefined,
      evaluationId: formText(formData, "evaluationId") || null,
    });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(`/t/${slug}/suppliers/${supplierId}`);
  return { ok: "Hallazgo registrado en borrador. Completalo y publicalo desde Hallazgos." };
}

export async function recordCommunicationAction(
  slug: string,
  supplierId: string,
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const access = await requireSupplierAccess(slug, "manage_suppliers");
  if ("error" in access) return { error: access.error };
  const file = formData.get("file");
  try {
    await recordCommunication({
      tenantId: access.tenant.id,
      actorUserId: access.ctx.userId,
      supplierId,
      kind: formText(formData, "kind") as SupplierCommunicationKindValue,
      channel: formText(formData, "channel") as SupplierCommunicationChannelValue,
      sentAt: formDate(formData, "sentAt"),
      summary: formText(formData, "summary"),
      recipientName: formText(formData, "recipientName"),
      evaluationId: formText(formData, "evaluationId") || null,
      file:
        file instanceof File && file.size > 0
          ? { fileName: file.name, contentType: file.type || "application/octet-stream", body: Buffer.from(await file.arrayBuffer()) }
          : undefined,
    });
  } catch (error) {
    return supplierFailure(error);
  }
  revalidatePath(`/t/${slug}/suppliers/${supplierId}`);
  return { ok: "Comunicación registrada" };
}
