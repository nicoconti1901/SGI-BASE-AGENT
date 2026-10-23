"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canManageHealthData } from "@/domain/safety-stats/access";
import { SafetyStatsError, updateSafetySettings, type SafetyUser } from "@/lib/safety-stats";
import { SAFETY_METRICS, setIndicatorLinks, type SafetyMetric } from "@/lib/safety-dashboard";
import { syncExposureDueItemsSafely } from "@/lib/safety-exposure";

export type SettingsState = { error?: string; ok?: string };

/** Los ajustes los cambia quien tiene `manage_safety_stats`. El permiso se verifica acá, no solo en la pantalla. */
export async function saveSafetySettingsAction(slug: string, _prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" };
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" };
  const membership = await getMembership(ctx.userId, tenant.id);
  const actor: SafetyUser = { userId: ctx.userId, role: membership?.role, isPlatformSuperuser: ctx.isPlatformSuperuser };
  if (!canManageHealthData(actor)) return { error: "Tu rol no permite cambiar los ajustes" };
  if (!(await getEnabledModulesCached(tenant.id)).has("safety_stats")) return { error: "El módulo no está activo" };

  const number = (name: string) => Number(String(formData.get(name) ?? "").trim().replace(/\./g, "").replace(",", "."));
  try {
    await updateSafetySettings({
      tenantId: tenant.id,
      actor,
      settings: {
        fatalChargeDays: number("fatalChargeDays"),
        severityBase: number("severityBase") === 1_000_000 ? 1_000_000 : 1000,
        exposureDueDay: number("exposureDueDay"),
        exposureOwnerUserId: String(formData.get("exposureOwnerUserId") ?? "") || null,
        showOptionalIndices: formData.get("showOptionalIndices") === "on",
      },
    });
    const links: Partial<Record<SafetyMetric, string | null>> = {};
    for (const metric of SAFETY_METRICS) links[metric] = String(formData.get(`indicator_${metric}`) ?? "") || null;
    await setIndicatorLinks({ tenantId: tenant.id, actor, links });
    // El día de vencimiento o el responsable cambian los avisos de carga abiertos.
    await syncExposureDueItemsSafely(tenant.id);
  } catch (error) {
    if (error instanceof SafetyStatsError) return { error: error.message };
    console.error(error);
    return { error: "No se pudo guardar. Probá de nuevo." };
  }
  revalidatePath(`/t/${slug}/safety`, "layout");
  return { ok: "Ajustes guardados" };
}
