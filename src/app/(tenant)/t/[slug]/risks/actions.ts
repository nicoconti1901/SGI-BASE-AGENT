"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { assertCanTenantRole } from "@/domain/identity/authz";
import { createRisk, updateRiskCanvas, addRiskAssessment, setRiskResponseDecision, transitionRiskStatus } from "@/lib/risks";
import { createOpportunity, updateOpportunityCanvas, addOpportunityAssessment, setOpportunityPursuitDecision, transitionOpportunityStatus } from "@/lib/opportunities";
import { createAction, completeAction, recordActionEffectiveness } from "@/lib/actions";
import { uploadActionAttachment } from "@/lib/action-attachments";
import { SOURCE_KINDS, type AssessmentMethod, type QualitativeLevel, type RiskResponseDecision, type SourceKind } from "@/domain/risks/types";
import type { OpportunityPursuitDecision, OpportunityStatus } from "@/domain/opportunities/types";
import type { EffectivenessStatus } from "@/domain/actions/types";
import type { RiskStatus } from "@/domain/risks/types";

export type RoActionState = {
  error?: string;
  ok?: string;
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

function parseSourceKind(raw: string): SourceKind {
  if (SOURCE_KINDS.includes(raw as SourceKind)) return raw as SourceKind;
  return "other";
}

export async function exploreContextAction(
  slug: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant || !gate.ctx) {
    return { error: "Sesión inválida" };
  }

  const sourceKind = parseSourceKind(String(formData.get("sourceKind") ?? ""));
  const sourceLabel = String(formData.get("sourceLabel") ?? "").trim();
  const findingId = String(formData.get("findingId") ?? "").trim() || null;
  const createRiskFlag = formData.get("createRisk") === "on";
  const createOppFlag = formData.get("createOpportunity") === "on";
  const riskTitle = String(formData.get("riskTitle") ?? "").trim();
  const oppTitle = String(formData.get("opportunityTitle") ?? "").trim();

  if (!sourceLabel) return { error: "Describí la fuente / contexto" };
  if (!createRiskFlag && !createOppFlag) {
    return { error: "Elegí crear riesgo, oportunidad, o ambos" };
  }

  try {
    let riskId: string | undefined;
    let oppId: string | undefined;

    if (createRiskFlag) {
      const risk = await createRisk({
        tenantId: gate.tenant.id,
        createdByUserId: gate.ctx.userId,
        draft: {
          title: riskTitle || `Riesgo: ${sourceLabel}`,
          statement: {
            cause: String(formData.get("cause") ?? ""),
            event: String(formData.get("event") ?? ""),
            effect: String(formData.get("effect") ?? ""),
          },
          existingControls: String(formData.get("existingControls") ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          sourceKind,
          sourceLabel,
          findingId,
        },
      });
      riskId = risk.id;
    }

    if (createOppFlag) {
      const opp = await createOpportunity({
        tenantId: gate.tenant.id,
        createdByUserId: gate.ctx.userId,
        draft: {
          title: oppTitle || `Oportunidad: ${sourceLabel}`,
          hypothesis: {
            condition: String(formData.get("condition") ?? ""),
            circumstance: String(formData.get("circumstance") ?? ""),
            benefit: String(formData.get("benefit") ?? ""),
          },
          sourceKind,
          sourceLabel,
          findingId,
        },
      });
      oppId = opp.id;
    }

    revalidatePath(`/t/${slug}/risks`);
    if (riskId && !oppId) redirect(`/t/${slug}/risks/${riskId}`);
    if (oppId && !riskId) redirect(`/t/${slug}/risks/opportunities/${oppId}`);
    redirect(`/t/${slug}/risks`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al explorar" };
  }
}

export async function createRiskDirectAction(
  slug: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant || !gate.ctx) {
    return { error: "Sesión inválida" };
  }

  try {
    const risk = await createRisk({
      tenantId: gate.tenant.id,
      createdByUserId: gate.ctx.userId,
      draft: {
        title: String(formData.get("title") ?? ""),
        statement: {
          cause: String(formData.get("cause") ?? ""),
          event: String(formData.get("event") ?? ""),
          effect: String(formData.get("effect") ?? ""),
        },
        existingControls: String(formData.get("existingControls") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        sourceKind: parseSourceKind(String(formData.get("sourceKind") ?? "")),
        sourceLabel: String(formData.get("sourceLabel") ?? ""),
        findingId: String(formData.get("findingId") ?? "").trim() || null,
      },
    });
    revalidatePath(`/t/${slug}/risks`);
    redirect(`/t/${slug}/risks/${risk.id}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear riesgo" };
  }
}

export async function saveRiskCanvasAction(
  slug: string,
  riskId: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant) return { error: "Sesión inválida" };

  try {
    await updateRiskCanvas({
      tenantId: gate.tenant.id,
      riskId,
      title: String(formData.get("title") ?? ""),
      cause: String(formData.get("cause") ?? ""),
      event: String(formData.get("event") ?? ""),
      effect: String(formData.get("effect") ?? ""),
      existingControls: String(formData.get("existingControls") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    revalidatePath(`/t/${slug}/risks/${riskId}`);
    return { ok: "Canvas actualizado" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" };
  }
}

export async function addRiskAssessmentAction(
  slug: string,
  riskId: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant || !gate.ctx) {
    return { error: "Sesión inválida" };
  }

  const method = String(formData.get("method") ?? "qualitative") as AssessmentMethod;
  const rationale = String(formData.get("rationale") ?? "");

  try {
    if (method === "probability_impact") {
      const probability = Number(formData.get("probability"));
      const impact = Number(formData.get("impact"));
      await addRiskAssessment({
        tenantId: gate.tenant.id,
        riskId,
        assessedById: gate.ctx.userId,
        assessment: {
          method: "probability_impact",
          probability,
          impact,
          score: probability * impact,
          rationale,
        },
      });
    } else {
      await addRiskAssessment({
        tenantId: gate.tenant.id,
        riskId,
        assessedById: gate.ctx.userId,
        assessment: {
          method: "qualitative",
          level: String(formData.get("level") ?? "medium") as QualitativeLevel,
          rationale,
        },
      });
    }
    revalidatePath(`/t/${slug}/risks/${riskId}`);
    return { ok: "Evaluación registrada (nueva versión)" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al evaluar" };
  }
}

export async function setRiskDecisionAction(
  slug: string,
  riskId: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant) return { error: "Sesión inválida" };

  const reviewRaw = String(formData.get("nextReviewAt") ?? "").trim();
  try {
    await setRiskResponseDecision({
      tenantId: gate.tenant.id,
      riskId,
      decision: String(formData.get("decision") ?? "") as RiskResponseDecision,
      rationale: String(formData.get("rationale") ?? ""),
      ownerUserId: String(formData.get("ownerUserId") ?? ""),
      nextReviewAt: reviewRaw ? new Date(reviewRaw) : null,
    });
    revalidatePath(`/t/${slug}/risks/${riskId}`);
    return { ok: "Decisión de respuesta guardada" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en decisión" };
  }
}

export async function transitionRiskAction(
  slug: string,
  riskId: string,
  to: RiskStatus,
  formData?: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant) return { error: "Sesión inválida" };

  try {
    await transitionRiskStatus({
      tenantId: gate.tenant.id,
      riskId,
      to,
      closeReason: formData
        ? String(formData.get("closeReason") ?? "")
        : undefined,
      closeRationale: formData
        ? String(formData.get("closeRationale") ?? "")
        : undefined,
    });
    revalidatePath(`/t/${slug}/risks/${riskId}`);
    revalidatePath(`/t/${slug}/risks`);
    return { ok: "Estado actualizado" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error de transición" };
  }
}

export async function saveOpportunityCanvasAction(
  slug: string,
  opportunityId: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant) return { error: "Sesión inválida" };

  try {
    await updateOpportunityCanvas({
      tenantId: gate.tenant.id,
      opportunityId,
      title: String(formData.get("title") ?? ""),
      condition: String(formData.get("condition") ?? ""),
      circumstance: String(formData.get("circumstance") ?? ""),
      benefit: String(formData.get("benefit") ?? ""),
    });
    revalidatePath(`/t/${slug}/risks/opportunities/${opportunityId}`);
    return { ok: "Canvas actualizado" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" };
  }
}

export async function addOpportunityAssessmentAction(
  slug: string,
  opportunityId: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant || !gate.ctx) {
    return { error: "Sesión inválida" };
  }

  try {
    await addOpportunityAssessment({
      tenantId: gate.tenant.id,
      opportunityId,
      assessedById: gate.ctx.userId,
      assessment: {
        method: "qualitative",
        level: String(formData.get("level") ?? "medium") as QualitativeLevel,
        rationale: String(formData.get("rationale") ?? ""),
      },
    });
    revalidatePath(`/t/${slug}/risks/opportunities/${opportunityId}`);
    return { ok: "Evaluación registrada (nueva versión)" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al evaluar" };
  }
}

export async function setOpportunityDecisionAction(
  slug: string,
  opportunityId: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant) return { error: "Sesión inválida" };

  const reviewRaw = String(formData.get("nextReviewAt") ?? "").trim();
  try {
    await setOpportunityPursuitDecision({
      tenantId: gate.tenant.id,
      opportunityId,
      decision: String(
        formData.get("decision") ?? "",
      ) as OpportunityPursuitDecision,
      rationale: String(formData.get("rationale") ?? ""),
      ownerUserId: String(formData.get("ownerUserId") ?? "") || undefined,
      nextReviewAt: reviewRaw ? new Date(reviewRaw) : null,
    });
    revalidatePath(`/t/${slug}/risks/opportunities/${opportunityId}`);
    revalidatePath(`/t/${slug}/risks`);
    return { ok: "Decisión guardada" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en decisión" };
  }
}

export async function transitionOpportunityAction(
  slug: string,
  opportunityId: string,
  to: OpportunityStatus,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant) return { error: "Sesión inválida" };

  try {
    await transitionOpportunityStatus({
      tenantId: gate.tenant.id,
      opportunityId,
      to,
    });
    revalidatePath(`/t/${slug}/risks/opportunities/${opportunityId}`);
    revalidatePath(`/t/${slug}/risks`);
    return { ok: "Estado actualizado" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error de transición" };
  }
}

export async function createLinkedActionAction(
  slug: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant || !gate.ctx) {
    return { error: "Sesión inválida" };
  }

  const targetType = String(formData.get("targetType") ?? "") as
    | "risk"
    | "opportunity"
    | "finding";
  const targetId = String(formData.get("targetId") ?? "");
  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const returnPath = String(formData.get("returnPath") ?? `/t/${slug}/risks`);

  try {
    await createAction({
      tenantId: gate.tenant.id,
      createdByUserId: gate.ctx.userId,
      draft: {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        ownerUserId: String(formData.get("ownerUserId") ?? ""),
        dueAt: dueRaw ? new Date(dueRaw) : null,
        links: [{ targetType, targetId }],
      },
    });
    revalidatePath(returnPath);
    revalidatePath(`/t/${slug}/risks`);
    return { ok: "Acción creada" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear acción" };
  }
}

export async function uploadActionEvidenceAction(
  slug: string,
  actionId: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant || !gate.ctx) {
    return { error: "Sesión inválida" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleccioná un archivo" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadActionAttachment({
      tenantId: gate.tenant.id,
      actionId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      body: buffer,
      uploadedById: gate.ctx.userId,
      label: String(formData.get("label") ?? "") || undefined,
    });
    const returnPath = String(formData.get("returnPath") ?? `/t/${slug}/risks`);
    revalidatePath(returnPath);
    return { ok: "Evidencia adjuntada" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al subir" };
  }
}

export async function completeActionAction(
  slug: string,
  actionId: string,
  returnPath: string,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant) return { error: "Sesión inválida" };

  try {
    await completeAction({ tenantId: gate.tenant.id, actionId });
    revalidatePath(returnPath);
    revalidatePath(`/t/${slug}/risks`);
    return { ok: "Acción completada (efectividad pendiente)" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al completar" };
  }
}

export async function recordEffectivenessAction(
  slug: string,
  actionId: string,
  _prev: RoActionState,
  formData: FormData,
): Promise<RoActionState> {
  const gate = await requireWrite(slug);
  if ("error" in gate && gate.error) return { error: gate.error };
  if (!("tenant" in gate) || !gate.tenant) return { error: "Sesión inválida" };

  const returnPath = String(formData.get("returnPath") ?? `/t/${slug}/risks`);
  try {
    await recordActionEffectiveness({
      tenantId: gate.tenant.id,
      actionId,
      effectiveness: String(
        formData.get("effectiveness") ?? "",
      ) as EffectivenessStatus,
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath(returnPath);
    revalidatePath(`/t/${slug}/risks`);
    return { ok: "Efectividad registrada" };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error al registrar efectividad",
    };
  }
}
