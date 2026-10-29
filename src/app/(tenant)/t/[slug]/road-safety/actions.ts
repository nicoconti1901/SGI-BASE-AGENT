"use server";

import { revalidatePath } from "next/cache";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canManageRoadSafety } from "@/domain/road-safety/access";
import { RoadSafetyError, addOdometerReset, getRoadSafetySettings, saveSpeedingPeriod, saveVehicleKm, updateRoadSafetySettings, type RoadUser } from "@/lib/road-safety";
import { addDriver, removeDriver, saveDriverLicense, setDriverTask } from "@/lib/road-drivers";

type Gate = { ok: false; error: string } | { ok: true; tenant: { id: string }; actor: RoadUser };

/** Sesión + permiso (`manage_road_safety`) + módulo activo. El permiso se verifica acá, no solo en la pantalla. */
async function gate(slug: string): Promise<Gate> {
  const ctx = await getAppSessionContext();
  if (!ctx) return { ok: false, error: "Debés iniciar sesión" };
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "Empresa no encontrada" };
  const membership = await getMembership(ctx.userId, tenant.id);
  const actor: RoadUser = { userId: ctx.userId, role: membership?.role, isPlatformSuperuser: ctx.isPlatformSuperuser };
  if (!canManageRoadSafety(actor)) return { ok: false, error: "Tu rol no permite gestionar la seguridad vial" };
  if (!(await getEnabledModulesCached(tenant.id)).has("road_safety")) return { ok: false, error: "El módulo no está activo" };
  return { ok: true, tenant, actor };
}

function failure(error: unknown): string {
  if (error instanceof RoadSafetyError) return error.message;
  console.error(error);
  return "No se pudo guardar. Probá de nuevo.";
}

export type RoadActionResult = { ok: true } | { ok: false; error: string };

/** Confirma el km calculado (sin `km`) o lo carga a mano (con `km` y motivo). */
export async function saveKmAction(
  slug: string,
  input: { assetId: string; month: string; km: number | null; reason: string },
): Promise<RoadActionResult> {
  const access = await gate(slug);
  if (!access.ok) return access;
  try {
    await saveVehicleKm({ tenantId: access.tenant.id, actor: access.actor, assetId: input.assetId, month: input.month, km: input.km, reason: input.reason });
    revalidatePath(`/t/${slug}/road-safety/km`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

/** Carga los excesos de velocidad de un vehículo en un mes cerrado (D21). */
export async function saveSpeedingAction(slug: string, input: { assetId: string; month: string; count: number; note: string }): Promise<RoadActionResult> {
  const access = await gate(slug);
  if (!access.ok) return access;
  try {
    await saveSpeedingPeriod({ tenantId: access.tenant.id, actor: access.actor, ...input });
    revalidatePath(`/t/${slug}/road-safety`, "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

/** Marca a una persona como conductor, o le saca la marca. */
export async function setDriverAction(slug: string, input: { personId: string; isDriver: boolean }): Promise<RoadActionResult> {
  const access = await gate(slug);
  if (!access.ok) return access;
  try {
    const args = { tenantId: access.tenant.id, actor: access.actor, personId: input.personId };
    if (input.isDriver) await addDriver(args);
    else await removeDriver(args);
    revalidatePath(`/t/${slug}/road-safety`, "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

/** Vencimiento de la licencia de un conductor; `null` la quita. */
export async function saveLicenseAction(slug: string, input: { personId: string; expiresOn: string | null }): Promise<RoadActionResult> {
  const access = await gate(slug);
  if (!access.ok) return access;
  try {
    await saveDriverLicense({ tenantId: access.tenant.id, actor: access.actor, personId: input.personId, expiresOn: input.expiresOn });
    revalidatePath(`/t/${slug}/road-safety`, "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

/** Tarea de conducción cuyos cursos obligatorios prueban el manejo defensivo; vacío la quita. */
export async function setDriverTaskAction(slug: string, input: { jobTaskId: string }): Promise<RoadActionResult> {
  const access = await gate(slug);
  if (!access.ok) return access;
  try {
    await setDriverTask({ tenantId: access.tenant.id, actor: access.actor, jobTaskId: input.jobTaskId || null });
    revalidatePath(`/t/${slug}/road-safety`, "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

/** Umbrales de la empresa (D16, D25). El desglose de excesos por conductor (D21) se conserva como está. */
export async function saveSettingsAction(slug: string, input: { minExposureKm: number; repeatThreshold: number; repeatWindowMonths: number }): Promise<RoadActionResult> {
  const access = await gate(slug);
  if (!access.ok) return access;
  try {
    const current = await getRoadSafetySettings(access.tenant.id);
    await updateRoadSafetySettings({ tenantId: access.tenant.id, actor: access.actor, settings: { ...current, ...input } });
    revalidatePath(`/t/${slug}/road-safety`, "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

/** Marca un reinicio o cambio de tablero del odómetro. */
export async function addResetAction(slug: string, input: { assetId: string; effectiveOn: string; reason: string }): Promise<RoadActionResult> {
  const access = await gate(slug);
  if (!access.ok) return access;
  try {
    await addOdometerReset({ tenantId: access.tenant.id, actor: access.actor, ...input });
    revalidatePath(`/t/${slug}/road-safety/km`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}
