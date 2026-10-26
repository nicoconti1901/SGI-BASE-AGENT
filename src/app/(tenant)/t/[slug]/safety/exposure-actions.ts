"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canManageHealthData } from "@/domain/safety-stats/access";
import { SafetyStatsError, type SafetyUser } from "@/lib/safety-stats";
import { applyExposureImport, previewExposureImport, saveExposure } from "@/lib/safety-exposure";
import type { ExposureImportAction } from "@/domain/safety-stats/exposure-import";

const MAX_CSV_CHARS = 2 * 1024 * 1024;

type Gate = { ok: false; error: string } | { ok: true; tenant: { id: string }; actor: SafetyUser };

/** Sesión + permiso (`manage_safety_stats`) + módulo activo. El permiso se verifica acá, no solo en la pantalla. */
async function gate(slug: string): Promise<Gate> {
  const ctx = await getAppSessionContext();
  if (!ctx) return { ok: false, error: "Debés iniciar sesión" };
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "Empresa no encontrada" };
  const membership = await getMembership(ctx.userId, tenant.id);
  const actor: SafetyUser = { userId: ctx.userId, role: membership?.role, isPlatformSuperuser: ctx.isPlatformSuperuser };
  if (!canManageHealthData(actor)) return { ok: false, error: "Tu rol no permite cargar la exposición" };
  if (!(await getEnabledModulesCached(tenant.id)).has("safety_stats")) return { ok: false, error: "El módulo no está activo" };
  return { ok: true, tenant, actor };
}

function failure(error: unknown): string {
  if (error instanceof SafetyStatsError) return error.message;
  console.error(error);
  return "No se pudo guardar. Probá de nuevo.";
}

export type ExposureRowPayload = {
  siteId: string;
  siteName: string;
  own?: { hours: number; headcountAvg: number };
  contractor?: { hours: number; headcountAvg: number };
};

export type SaveGridResult = { ok: true; saved: number; corrected: number; warnings: string[] } | { ok: false; error: string };

/** Guarda las sedes que cambiaron. Cada sede es atómica; si una falla, las anteriores ya quedaron guardadas. */
export async function saveExposureGridAction(slug: string, month: string, rows: ExposureRowPayload[], reason: string): Promise<SaveGridResult> {
  const access = await gate(slug);
  if (!access.ok) return access;
  if (rows.length === 0) return { ok: false, error: "No hay cambios para guardar" };
  let saved = 0;
  let corrected = 0;
  const warnings: string[] = [];
  for (const row of rows) {
    try {
      const done = await saveExposure({ tenantId: access.tenant.id, actor: access.actor, siteId: row.siteId, month, own: row.own, contractor: row.contractor, reason });
      saved += done.created;
      corrected += done.updated;
      warnings.push(...done.warnings.map((w) => `${row.siteName} · ${w}`));
    } catch (error) {
      const prefix = saved + corrected > 0 ? `Se guardaron las sedes anteriores. ` : "";
      revalidatePath(`/t/${slug}/safety`, "layout");
      return { ok: false, error: `${prefix}${row.siteName}: ${failure(error)}` };
    }
  }
  revalidatePath(`/t/${slug}/safety`, "layout");
  return { ok: true, saved, corrected, warnings };
}

// ─── Importación ───────────────────────────────────────────────────────────

export type ExposureImportPreviewView = {
  counts: Record<ExposureImportAction, number>;
  parseErrors: { line: number; field: string; message: string }[];
  needsReason: boolean;
  items: { line: number; action: ExposureImportAction; siteRef: string; month: string; employerKind: string; hours: number; headcountAvg: number; message?: string }[];
};

export type ExposureImportState = {
  error?: string;
  preview?: ExposureImportPreviewView;
  done?: { counts: Record<ExposureImportAction, number>; errors: number };
};

export async function previewExposureImportAction(slug: string, csv: string): Promise<ExposureImportState> {
  const access = await gate(slug);
  if (!access.ok) return { error: access.error };
  if (csv.length > MAX_CSV_CHARS) return { error: "El archivo es muy grande (máximo 2 MB)" };
  try {
    const { plan, parseErrors, needsReason } = await previewExposureImport(access.tenant.id, csv);
    return {
      preview: {
        counts: plan.counts,
        parseErrors,
        needsReason,
        items: plan.items
          .filter((i) => i.action !== "unchanged" && i.row)
          .slice(0, 200)
          .map((i) => ({
            line: i.line,
            action: i.action,
            siteRef: i.row!.siteRef,
            month: i.row!.month,
            employerKind: i.row!.employerKind,
            hours: i.row!.hours,
            headcountAvg: i.row!.headcountAvg,
            message: i.message,
          })),
      },
    };
  } catch (error) {
    return { error: failure(error) };
  }
}

export async function applyExposureImportAction(slug: string, csv: string, reason: string): Promise<ExposureImportState> {
  const access = await gate(slug);
  if (!access.ok) return { error: access.error };
  if (csv.length > MAX_CSV_CHARS) return { error: "El archivo es muy grande (máximo 2 MB)" };
  try {
    const done = await applyExposureImport({ tenantId: access.tenant.id, actor: access.actor, csv, reason });
    revalidatePath(`/t/${slug}/safety`, "layout");
    return { done };
  } catch (error) {
    return { error: failure(error) };
  }
}
