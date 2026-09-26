"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { assertCanTenantRole } from "@/domain/identity/authz";
import {
  closeFindingMeasure,
  createFindingDraft,
  publishFinding,
  saveFindingDraft,
} from "@/lib/findings";
import { isFindingType, type FindingDraft, type MeasureKind, type RootCauseAnalysis } from "@/domain/findings/types";
import { createInitialWhyStep } from "@/domain/findings/five-whys";

export type FindingActionState = {
  error?: string;
  ok?: string;
  findingId?: string;
};

async function requireWrite(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" as const };
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Tenant no encontrado" as const };
  const membership = await getMembership(ctx.userId, tenant.id);
  try {
    assertCanTenantRole(membership?.role, "write", {
      isPlatformSuperuser: ctx.isPlatformSuperuser,
    });
  } catch {
    return { error: "Sin permiso de escritura" as const };
  }
  return { ctx, tenant };
}

function parseDraft(formData: FormData): FindingDraft {
  const typeRaw = String(formData.get("type") ?? "");
  if (!isFindingType(typeRaw)) {
    throw new Error("Tipo de hallazgo inválido");
  }

  const rcaRaw = String(formData.get("rcaJson") ?? "");
  let rca: RootCauseAnalysis;
  if (rcaRaw) {
    rca = JSON.parse(rcaRaw) as RootCauseAnalysis;
    if (rca.rootCauseConfirmedAt) {
      rca.rootCauseConfirmedAt = new Date(rca.rootCauseConfirmedAt);
    }
  } else {
    rca = {
      method: "five_whys",
      problemStatement: String(formData.get("title") ?? ""),
      steps: [createInitialWhyStep(String(formData.get("title") ?? ""))],
      rootCause: null,
      rootCauseConfirmedAt: null,
      rootCauseConfirmedByUserId: null,
      status: "incomplete",
    };
  }

  const measureCount = Number(formData.get("measureCount") ?? 0);
  const measures = [];
  for (let i = 0; i < measureCount; i += 1) {
    const dueRaw = String(formData.get(`measureDue_${i}`) ?? "").trim();
    measures.push({
      kind: String(formData.get(`measureKind_${i}`) ?? "corrective") as MeasureKind,
      title: String(formData.get(`measureTitle_${i}`) ?? ""),
      description: String(formData.get(`measureDesc_${i}`) ?? ""),
      ownerUserId: String(formData.get(`measureOwner_${i}`) ?? ""),
      dueAt: dueRaw ? new Date(dueRaw) : null,
      linkedRootCause: formData.get(`measureLinked_${i}`) === "on",
    });
  }

  const notifyUserIds = formData
    .getAll("notifyUserId")
    .map(String)
    .filter(Boolean);

  return {
    type: typeRaw,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    detectedAt: new Date(String(formData.get("detectedAt") ?? "")),
    source: String(formData.get("source") ?? ""),
    location: String(formData.get("location") ?? ""),
    severity: String(formData.get("severity") ?? ""),
    rca,
    measures,
    notifyUserIds,
  };
}

export async function startFindingAction(
  slug: string,
  _prev: FindingActionState,
  formData: FormData,
): Promise<FindingActionState> {
  const auth = await requireWrite(slug);
  if ("error" in auth && auth.error) return { error: auth.error };
  if (!("tenant" in auth) || !auth.tenant || !auth.ctx) {
    return { error: "Sin acceso" };
  }

  const typeRaw = String(formData.get("type") ?? "");
  if (!isFindingType(typeRaw)) return { error: "Tipo inválido" };

  try {
    const finding = await createFindingDraft({
      tenantId: auth.tenant.id,
      type: typeRaw,
      title: String(formData.get("title") ?? "Borrador de hallazgo"),
      description: String(formData.get("description") ?? "Completar"),
      detectedAt: new Date(),
      createdByUserId: auth.ctx.userId,
      source: String(formData.get("source") ?? ""),
    });
    revalidatePath(`/t/${slug}/findings`);
    redirect(`/t/${slug}/findings/${finding.id}/edit`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      error: error instanceof Error ? error.message : "No se pudo crear",
    };
  }
}

export async function saveOrPublishFindingAction(
  slug: string,
  findingId: string,
  mode: "save" | "publish",
  _prev: FindingActionState,
  formData: FormData,
): Promise<FindingActionState> {
  const auth = await requireWrite(slug);
  if ("error" in auth && auth.error) return { error: auth.error };
  if (!("tenant" in auth) || !auth.tenant || !auth.ctx) {
    return { error: "Sin acceso" };
  }

  try {
    const draft = parseDraft(formData);
    if (mode === "save") {
      await saveFindingDraft({
        tenantId: auth.tenant.id,
        findingId,
        draft,
      });
      revalidatePath(`/t/${slug}/findings/${findingId}/edit`);
      return { ok: "Borrador guardado", findingId };
    }

    await publishFinding({
      tenantId: auth.tenant.id,
      findingId,
      draft,
      actorUserId: auth.ctx.userId,
    });
    revalidatePath(`/t/${slug}/findings`);
    revalidatePath(`/t/${slug}/findings/${findingId}`);
    redirect(`/t/${slug}/findings/${findingId}`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar",
    };
  }
}

export async function closeMeasureAction(
  slug: string,
  findingId: string,
  measureId: string,
  _formData?: FormData,
): Promise<void> {
  const auth = await requireWrite(slug);
  if ("error" in auth && auth.error) {
    throw new Error(auth.error);
  }
  if (!("tenant" in auth) || !auth.tenant) {
    throw new Error("Sin acceso");
  }

  await closeFindingMeasure({
    tenantId: auth.tenant.id,
    measureId,
  });
  revalidatePath(`/t/${slug}/findings/${findingId}`);
}
