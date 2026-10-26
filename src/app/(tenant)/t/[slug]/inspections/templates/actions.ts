"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppSessionContext } from "@/lib/session";
import { getTenantBySlug } from "@/lib/tenant-provisioning";
import { getMembership } from "@/lib/identity";
import { getEnabledModulesCached } from "@/lib/modules";
import { canTenantRole } from "@/domain/identity/authz";
import { InspectionError } from "@/lib/inspection-support";
import { getTemplateForEdit, restoreTemplate, saveTemplate, type EditorSnapshot } from "@/lib/inspection-templates";

export type TemplateSaveResult =
  | { ok: true; changed: boolean; version: number; warnings: string[]; snapshot: EditorSnapshot }
  | { ok: false; error: string; conflict?: boolean };

const payloadSchema = z.object({
  expectedVersionId: z.string().min(1),
  name: z.string().max(200),
  intervalUnit: z.enum(["days", "months"]).nullable(),
  intervalValue: z.number().nullable(),
  findingOnCritical: z.boolean(),
  items: z
    .array(
      z.object({
        code: z.string().optional(),
        section: z.string().max(200),
        text: z.string().max(2000),
        help: z.string().max(2000).nullish(),
        criticality: z.enum(["critical", "major", "minor"]),
        naAllowed: z.boolean(),
        photoOnNc: z.boolean(),
      }),
    )
    .max(200),
});

export type TemplatePayload = z.input<typeof payloadSchema>;

/** Solo el administrador edita plantillas (`manage_inspection_templates`). Un módulo apagado no acepta acciones. */
async function requireTemplateAdmin(slug: string) {
  const ctx = await getAppSessionContext();
  if (!ctx) return { ok: false, error: "Debés iniciar sesión" } as const;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "Empresa no encontrada" } as const;
  const membership = await getMembership(ctx.userId, tenant.id);
  if (!canTenantRole(membership?.role, "manage_inspection_templates", { isPlatformSuperuser: ctx.isPlatformSuperuser })) {
    return { ok: false, error: "Solo el administrador puede editar las plantillas" } as const;
  }
  if (!(await getEnabledModulesCached(tenant.id)).has("inspections")) return { ok: false, error: "El módulo no está activo" } as const;
  return { ok: true, ctx, tenant } as const;
}

function failure(error: unknown): TemplateSaveResult {
  if (error instanceof InspectionError) return { ok: false, error: error.message, conflict: error.code === "conflict" };
  console.error(error);
  return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
}

async function snapshotOf(tenantId: string, templateId: string): Promise<EditorSnapshot> {
  const editor = await getTemplateForEdit(tenantId, templateId);
  if (!editor) throw new InspectionError("No se encontró la plantilla");
  return editor.snapshot;
}

export async function saveTemplateAction(slug: string, templateId: string, payload: TemplatePayload): Promise<TemplateSaveResult> {
  const access = await requireTemplateAdmin(slug);
  if (!access.ok) return access;
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Los datos de la plantilla no son válidos" };
  try {
    const result = await saveTemplate({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, templateId, ...parsed.data, items: parsed.data.items });
    revalidatePath(`/t/${slug}/inspections/templates`);
    revalidatePath(`/t/${slug}/inspections/templates/${templateId}`);
    return { ok: true, changed: result.changed, version: result.version, warnings: result.warnings.map((w) => w.message), snapshot: await snapshotOf(access.tenant.id, templateId) };
  } catch (error) {
    return failure(error);
  }
}

export async function restoreTemplateAction(slug: string, templateId: string, expectedVersionId: string): Promise<TemplateSaveResult> {
  const access = await requireTemplateAdmin(slug);
  if (!access.ok) return access;
  try {
    const result = await restoreTemplate({ tenantId: access.tenant.id, actorUserId: access.ctx.userId, templateId, expectedVersionId });
    revalidatePath(`/t/${slug}/inspections/templates`);
    revalidatePath(`/t/${slug}/inspections/templates/${templateId}`);
    return { ok: true, changed: result.changed, version: result.version, warnings: result.warnings.map((w) => w.message), snapshot: await snapshotOf(access.tenant.id, templateId) };
  } catch (error) {
    return failure(error);
  }
}
