import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { createAsset } from "@/lib/assets";
import { closeInspection, getInspectionView, saveAnswer, startInspection } from "@/lib/inspections";
import { getTemplateForEdit, listTemplates, restoreTemplate, saveTemplate } from "@/lib/inspection-templates";
import { InspectionError } from "@/lib/inspection-support";
import { EXTINGUISHER_PERIODIC } from "@/domain/inspections/templates/extinguisher";
import type { ItemEdit } from "@/domain/inspections/templates/edit";
import type { TemplateItemDef } from "@/domain/inspections/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);

const toEdit = (i: TemplateItemDef): ItemEdit => ({ code: i.code, section: i.section, text: i.text, help: i.help ?? null, criticality: i.criticality, naAllowed: i.naAllowed, photoOnNc: i.photoOnNc });

describe.skipIf(!hasDatabase)("editor de plantillas con versiones (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let admin = "";
  let siteA = "";
  let seq = 0;

  const newAsset = () =>
    createAsset({
      tenantId: a,
      actorUserId: admin,
      typeKey: "extinguisher",
      code: `P${stamp % 100000}-${++seq}`,
      description: "Pasillo",
      siteId: siteA,
      attributes: { agent: "abc", capacityKg: 5, manufacturedAt: "2022-05-10" },
      dueDates: [{ kind: "maintenance", lastDoneAt: "2026-03-31" }],
    });

  const load = async (tenantId = a) => {
    await listTemplates(tenantId);
    const template = await db.inspectionTemplate.findUniqueOrThrow({ where: { tenantId_key: { tenantId, key: "extinguisher_periodic" } } });
    return (await getTemplateForEdit(tenantId, template.id))!;
  };
  const base = (editor: Awaited<ReturnType<typeof load>>) => ({
    tenantId: a,
    actorUserId: admin,
    templateId: editor.template.id,
    expectedVersionId: editor.versionId,
    name: editor.template.name,
    intervalUnit: editor.template.intervalUnit,
    intervalValue: editor.template.intervalValue,
    findingOnCritical: editor.template.findingOnCritical,
    items: editor.items.map(toEdit),
  });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `InspT ${label}`, slug: `inspt-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    admin = (await db.user.create({ data: { name: "Ana Admin", email: `inspt-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: admin, name: "Base" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: admin } });
    await db.$disconnect();
  });

  it("lista las plantillas precargadas con su cantidad de ítems", async () => {
    const list = await listTemplates(a);
    const ext = list.find((t) => t.key === "extinguisher_periodic")!;
    expect(ext.itemCount).toBe(EXTINGUISHER_PERIODIC.items.length);
    expect(ext.activeVersion?.version).toBe(1);
  });

  it("sin cambios no se crea una versión nueva", async () => {
    const editor = await load();
    const result = await saveTemplate(base(editor));
    expect(result).toMatchObject({ changed: false, version: 1 });
    expect(await db.inspectionTemplateVersion.count({ where: { templateId: editor.template.id } })).toBe(1);
  });

  it("editar crea la versión 2; la inspección cerrada con la versión 1 conserva ítems y resultado; el borrador abierto sigue en la 1", async () => {
    const closedAsset = await newAsset();
    const draftAsset = await newAsset();
    const closed = await startInspection({ tenantId: a, actorUserId: admin, assetId: closedAsset.id });
    const draft = await startInspection({ tenantId: a, actorUserId: admin, assetId: draftAsset.id });

    const view = (await getInspectionView(a, closed.id))!;
    for (const row of view.items.filter((i) => !i.answer.autoDerived)) {
      await saveAnswer({ tenantId: a, actorUserId: admin, canEditOthers: false, inspectionId: closed.id, itemId: row.item.id, patch: { value: "conform" } });
    }
    await closeInspection({ tenantId: a, actorUserId: admin, canEditOthers: false, inspectionId: closed.id });
    const before = (await getInspectionView(a, closed.id))!;

    const editor = await load();
    const edits = base(editor);
    edits.name = "Control mensual de extintores";
    edits.intervalValue = 2;
    edits.items = [
      ...edits.items.filter((i) => i.code !== "loc_mount").map((i) => (i.code === "ident_instructions" ? { ...i, text: "Instrucciones legibles", criticality: "major" as const } : i)),
      { section: "Extra", text: "Cartel de uso colocado", criticality: "minor", naAllowed: true, photoOnNc: false },
    ];
    const saved = await saveTemplate(edits);
    expect(saved).toMatchObject({ changed: true, version: 2 });

    const v2 = await load();
    expect(v2.template).toMatchObject({ name: "Control mensual de extintores", intervalValue: 2 });
    expect(v2.items.some((i) => i.code === "loc_mount")).toBe(false);
    expect(v2.items.at(-1)).toMatchObject({ code: "custom_1", text: "Cartel de uso colocado", kind: "check" });
    expect(v2.items.find((i) => i.code === "state_gauge")?.appliesWhen).toBeTruthy();
    expect(v2.versions.map((v) => v.version)).toEqual([2, 1]);

    const after = (await getInspectionView(a, closed.id))!;
    expect(after.inspection.templateVersion.version).toBe(1);
    expect(after.items.map((i) => i.item.code)).toEqual(before.items.map((i) => i.item.code));
    expect(after.items.map((i) => i.item.text)).toEqual(before.items.map((i) => i.item.text));
    expect(after.inspection.result).toBe(before.inspection.result);

    expect((await getInspectionView(a, draft.id))!.inspection.templateVersion.version).toBe(1);
    const fresh = await startInspection({ tenantId: a, actorUserId: admin, assetId: (await newAsset()).id });
    const freshView = (await getInspectionView(a, fresh.id))!;
    expect(freshView.inspection.templateVersion.version).toBe(2);
    expect(freshView.items.some((i) => i.item.code === "custom_1")).toBe(true);
  });

  it("rechaza lo que no es válido sin crear nada: frecuencia de extintores > 3 meses y quitar un ítem automático", async () => {
    const editor = await load();
    const versions = () => db.inspectionTemplateVersion.count({ where: { templateId: editor.template.id } });
    const count = await versions();
    await expect(saveTemplate({ ...base(editor), intervalUnit: "months", intervalValue: 4 })).rejects.toBeInstanceOf(InspectionError);
    await expect(saveTemplate({ ...base(editor), items: base(editor).items.filter((i) => i.code !== "docs_hydrostatic") })).rejects.toThrow(/lo completa el sistema/);
    await expect(saveTemplate({ ...base(editor), items: [...base(editor).items, { code: "inventado", section: "x", text: "y", criticality: "minor", naAllowed: true, photoOnNc: false }] })).rejects.toBeInstanceOf(InspectionError);
    expect(await versions()).toBe(count);
  });

  it("guardar con una versión vieja abierta es un conflicto; dos guardados simultáneos dejan una sola versión nueva", async () => {
    const editor = await load();
    const stale = base(editor);
    const first = { ...base(editor), name: "Nombre A" };
    const second = { ...base(editor), name: "Nombre B" };
    const results = await Promise.allSettled([saveTemplate(first), saveTemplate(second)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: "conflict" });
    await expect(saveTemplate({ ...stale, name: "Tarde" })).rejects.toMatchObject({ code: "conflict" });
  });

  it("restaurar la original vuelve a los valores precargados como versión nueva", async () => {
    const editor = await load();
    const restored = await restoreTemplate({ tenantId: a, actorUserId: admin, templateId: editor.template.id, expectedVersionId: editor.versionId });
    expect(restored.changed).toBe(true);
    const now = await load();
    expect(now.template).toMatchObject({ name: EXTINGUISHER_PERIODIC.name, intervalUnit: "months", intervalValue: 1 });
    expect(now.items.map((i) => i.code)).toEqual(EXTINGUISHER_PERIODIC.items.map((i) => i.code));
    expect(now.versions[0].version).toBe(restored.version);
    // Ya está en la original: restaurar de nuevo no crea otra.
    const again = await restoreTemplate({ tenantId: a, actorUserId: admin, templateId: now.template.id, expectedVersionId: now.versionId });
    expect(again.changed).toBe(false);
  });

  it("deja registro de auditoría de cada versión", async () => {
    const editor = await load();
    const audits = await db.inspectionAudit.findMany({ where: { tenantId: a, entityType: "inspection_template", entityId: editor.template.id } });
    expect(audits.length).toBeGreaterThanOrEqual(2);
    expect(audits.every((x) => x.actorUserId === admin && x.action === "version_created")).toBe(true);
  });

  it("aislamiento: la empresa B no puede ver ni editar la plantilla de A", async () => {
    const editor = await load();
    expect(await getTemplateForEdit(b, editor.template.id)).toBeNull();
    await expect(saveTemplate({ ...base(editor), tenantId: b })).rejects.toBeInstanceOf(InspectionError);
    await expect(restoreTemplate({ tenantId: b, actorUserId: admin, templateId: editor.template.id, expectedVersionId: editor.versionId })).rejects.toBeInstanceOf(InspectionError);
    expect((await load()).versions.length).toBeGreaterThan(0);
    const listB = await listTemplates(b);
    expect(listB.every((t) => t.tenantId === b)).toBe(true);
  });
});
