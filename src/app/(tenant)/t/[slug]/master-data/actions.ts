"use server";

import { revalidatePath } from "next/cache";
import type { SiteKind } from "@prisma/client";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { canTenantRole } from "@/domain/identity/authz";
import {
  MasterDataError,
  createJobPosition,
  createJobTask,
  createSite,
  deactivateCatalogItem,
  reactivateCatalogItem,
  renameJobPosition,
  updateJobTask,
  updateSite,
} from "@/lib/masterdata";
import { SITE_KINDS, type MasterDataEntity } from "@/domain/masterdata/types";

export type MasterDataActionState = { error?: string; ok?: string };

const ENTITIES: readonly MasterDataEntity[] = ["site", "position", "task"];
const PATHS: Record<MasterDataEntity, string> = { site: "sites", position: "positions", task: "tasks" };

async function requireManager(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!canTenantRole(membership?.role, "manage_master_data", { isPlatformSuperuser: ctx.isPlatformSuperuser })) {
    return { error: "Tu rol no tiene permiso para modificar datos maestros" } as const;
  }
  return { ctx, tenant } as const;
}

function fail(error: unknown): MasterDataActionState {
  if (error instanceof MasterDataError) return { error: error.message };
  console.error(error);
  return { error: "No se pudo guardar. Probá de nuevo." };
}

/** Alta (`id` vacío) o edición de una sede, puesto o tarea. */
export async function saveCatalogItemAction(
  slug: string,
  entity: MasterDataEntity,
  id: string | null,
  _prev: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  if (!ENTITIES.includes(entity)) return { error: "Tipo inválido" };
  const access = await requireManager(slug);
  if ("error" in access) return { error: access.error };
  const { ctx, tenant } = access;
  const base = { tenantId: tenant.id, actorUserId: ctx.userId };
  const name = String(formData.get("name") ?? "");

  try {
    if (entity === "site") {
      const kindRaw = String(formData.get("kind") ?? "office");
      const kind = (SITE_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as SiteKind) : "office";
      const address = String(formData.get("address") ?? "");
      if (id) await updateSite({ ...base, id, name, kind, address });
      else await createSite({ ...base, name, kind, address });
    } else if (entity === "position") {
      if (id) await renameJobPosition({ ...base, id, name });
      else await createJobPosition({ ...base, name });
    } else {
      const critical = formData.get("critical") === "on";
      if (id) await updateJobTask({ ...base, id, name, critical });
      else await createJobTask({ ...base, name, critical });
    }
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/master-data/${PATHS[entity]}`);
  return { ok: id ? "Cambios guardados" : "Alta registrada" };
}

/** Baja lógica o reactivación. La baja se bloquea si hay personas activas que dependen del ítem. */
export async function setCatalogItemActiveAction(
  slug: string,
  entity: MasterDataEntity,
  id: string,
  active: boolean,
  ..._rest: [MasterDataActionState, FormData?]
): Promise<MasterDataActionState> {
  if (!ENTITIES.includes(entity)) return { error: "Tipo inválido" };
  const access = await requireManager(slug);
  if ("error" in access) return { error: access.error };
  const { ctx, tenant } = access;
  try {
    const input = { entity, tenantId: tenant.id, actorUserId: ctx.userId, id };
    if (active) await reactivateCatalogItem(input);
    else await deactivateCatalogItem(input);
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`/t/${slug}/master-data/${PATHS[entity]}`);
  return { ok: active ? "Reactivada" : "Dada de baja" };
}
