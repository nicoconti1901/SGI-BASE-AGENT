import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { applyAssetImport, createAsset, previewAssetImport, retireAsset } from "@/lib/assets";
import { addInspectionPhoto, closeInspection, getInspectionView, saveAnswer, startInspection } from "@/lib/inspections";
import { listSiteSchedule, scheduleSiteInspection, siteExtinguisherStatus, startSiteInspection, unscheduleSiteInspection } from "@/lib/inspection-sites";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { addDays, addMonths, isoFromDate, todayIso } from "@/domain/inspections/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("zona de obradores y arneses (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let inspector = "";
  let other = "";
  let siteA = "";
  let siteA2 = "";
  let siteB = "";
  let seq = 0;

  /** Responde todo «conforme» salvo lo indicado; lo crítico o mayor no conforme lleva comentario y foto. */
  async function fill(tenantId: string, inspectionId: string, nonconform: string[] = []) {
    const view = (await getInspectionView(tenantId, inspectionId))!;
    for (const row of view.items.filter((i) => !i.answer.autoDerived)) {
      const bad = nonconform.includes(row.item.code);
      await saveAnswer({ tenantId, actorUserId: inspector, canEditOthers: false, inspectionId, itemId: row.item.id, patch: { value: bad ? "nonconform" : "conform", ...(bad ? { comment: "Se ve mal" } : {}) } });
      if (bad && row.item.photoOnNc) {
        await addInspectionPhoto({ tenantId, actorUserId: inspector, canEditOthers: false, inspectionId, itemId: row.item.id, fileName: "f.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage });
      }
    }
  }
  const close = (inspectionId: string) => closeInspection({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `ObrArn ${label}`, slug: `obrarn-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    inspector = (await db.user.create({ data: { name: "Inés Inspectora", email: `obrarn-${stamp}@test.dev`, emailVerified: true } })).id;
    other = (await db.user.create({ data: { name: "Otro Inspector", email: `obrarn-o-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra Norte" })).id;
    siteA2 = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra Sur" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: inspector, name: "Obra B" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [inspector, other] } } });
    await db.$disconnect();
  });

  describe("zona de obradores (área sin activo, programa por sede)", () => {
    it("programar la sede deja un programa y un único vencimiento a 7 días; repetir no duplica", async () => {
      const plan = await scheduleSiteInspection({ tenantId: a, actorUserId: inspector, siteId: siteA });
      await scheduleSiteInspection({ tenantId: a, actorUserId: inspector, siteId: siteA });
      expect(plan).toMatchObject({ subjectKey: `site:${siteA}`, assetId: null, siteId: siteA, active: true });
      expect(isoFromDate(plan.nextDueAt!)).toBe(addDays(todayIso(), 7));
      const dues = await db.dueItem.findMany({ where: { tenantId: a, entityType: "inspection_plan", entityId: plan.id, status: "open" } });
      expect(dues).toHaveLength(1);
      expect(dues[0]).toMatchObject({ siteId: siteA, leadDays: 2, ownerUserId: null });
      expect(await db.inspectionPlan.count({ where: { tenantId: a, subjectKey: `site:${siteA}` } })).toBe(1);
    });

    it("el borrador se retoma (doble toque, o dos pedidos a la vez) y trae los 24 ítems sin activo", async () => {
      const [x, y] = await Promise.all([
        startSiteInspection({ tenantId: a, actorUserId: inspector, siteId: siteA2 }),
        startSiteInspection({ tenantId: a, actorUserId: inspector, siteId: siteA2 }),
      ]);
      expect(x.id).toBe(y.id);
      const z = await startSiteInspection({ tenantId: a, actorUserId: inspector, siteId: siteA2 });
      expect(z.id).toBe(x.id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id: x.id }, include: { answers: true, template: true } });
      expect(inspection).toMatchObject({ assetId: null, siteId: siteA2, status: "draft" });
      expect(inspection.template.key).toBe("site_obrador");
      expect(inspection.answers).toHaveLength(24);
      // Otro inspector tiene su propio borrador.
      const mine = await startSiteInspection({ tenantId: a, actorUserId: other, siteId: siteA2 });
      expect(mine.id).not.toBe(x.id);
    });

    it("una sede de otra empresa o inexistente no se puede inspeccionar ni programar", async () => {
      await expect(startSiteInspection({ tenantId: a, actorUserId: inspector, siteId: siteB })).rejects.toThrow(/sede/);
      await expect(scheduleSiteInspection({ tenantId: a, actorUserId: inspector, siteId: siteB })).rejects.toThrow(/sede/);
      expect(await db.inspectionPlan.count({ where: { siteId: siteB } })).toBe(0);
    });

    it("cerrar apta: una sola inspección, programa a 7 días, sin acción ni hallazgo", async () => {
      const site = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra Apta" })).id;
      const { id } = await startSiteInspection({ tenantId: a, actorUserId: inspector, siteId: site });
      await fill(a, id);
      const first = await close(id);
      const again = await close(id);
      expect(first.alreadyClosed).toBe(false);
      expect(again.alreadyClosed).toBe(true);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection).toMatchObject({ status: "closed", result: "fit", actionId: null, findingId: null, applicableCount: 24, nonconformCount: 0 });
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, subjectKey: `site:${site}` } });
      expect(plan).toMatchObject({ lastInspectionId: id, lastResult: "fit", active: true });
      expect(isoFromDate(plan.nextDueAt!)).toBe(addDays(todayIso(), 7));
      expect(await db.dueItem.count({ where: { tenantId: a, entityType: "inspection_plan", entityId: plan.id, status: "open" } })).toBe(1);
    });

    it("cerrar con una crítica: no apta, una acción con responsable y plazo, hallazgo borrador de origen inspección, reinspección a 7 días", async () => {
      const site = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra Crítica" })).id;
      const { id } = await startSiteInspection({ tenantId: a, actorUserId: inspector, siteId: site });
      await fill(a, id, ["power_panels", "order_waste"]);
      await Promise.all([close(id), close(id)]);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { action: true, finding: true } });
      expect(inspection).toMatchObject({ result: "unfit", nonconformCount: 2 });
      expect(inspection.action).toMatchObject({ ownerUserId: inspector });
      expect(todayIso(inspection.action!.dueAt!)).toBe(addDays(todayIso(), 2));
      expect(inspection.finding).toMatchObject({ origin: "inspection" });
      expect(inspection.finding!.description).toContain("Tableros con tapa");
      expect(inspection.finding!.description).not.toContain("residuos");
      expect(await db.action.count({ where: { tenantId: a, id: inspection.actionId! } })).toBe(1);
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, subjectKey: `site:${site}` } });
      expect(plan.lastResult).toBe("unfit");
      expect(isoFromDate(plan.nextDueAt!)).toBe(addDays(todayIso(), 7));
      const dues = await db.dueItem.findMany({ where: { tenantId: a, entityType: "inspection_plan", entityId: plan.id, status: "open" } });
      expect(dues).toHaveLength(1);
      expect(dues[0].title).toMatch(/Reinspección/);
    });

    it("solo observaciones menores: apta con observaciones, con acción y sin hallazgo", async () => {
      const site = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra Menor" })).id;
      const { id } = await startSiteInspection({ tenantId: a, actorUserId: inspector, siteId: site });
      await fill(a, id, ["order_waste"]);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection.result).toBe("fit_with_observations");
      expect(inspection.actionId).not.toBeNull();
      expect(inspection.findingId).toBeNull();
    });

    it("el listado de sedes muestra el programa y quitar la sede cierra su vencimiento", async () => {
      const rows = await listSiteSchedule(a);
      const north = rows.find((r) => r.id === siteA)!;
      expect(north).toMatchObject({ scheduled: true, overdue: false, nextDueAt: addDays(todayIso(), 7) });
      expect(rows.find((r) => r.id === siteA2)!.scheduled).toBe(false);
      expect((await listSiteSchedule(a, { q: "norte" })).map((r) => r.id)).toEqual([siteA]);
      expect((await listSiteSchedule(b)).map((r) => r.id)).toEqual([siteB]);

      await unscheduleSiteInspection({ tenantId: a, actorUserId: inspector, siteId: siteA });
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, subjectKey: `site:${siteA}` } });
      expect(plan).toMatchObject({ active: false, nextDueAt: null });
      expect(await db.dueItem.count({ where: { tenantId: a, entityType: "inspection_plan", entityId: plan.id, status: "open" } })).toBe(0);
      // Programarla otra vez la reactiva sin duplicar el programa.
      await scheduleSiteInspection({ tenantId: a, actorUserId: inspector, siteId: siteA });
      expect(await db.inspectionPlan.count({ where: { tenantId: a, subjectKey: `site:${siteA}` } })).toBe(1);
      expect(await db.dueItem.count({ where: { tenantId: a, entityType: "inspection_plan", entityId: plan.id, status: "open" } })).toBe(1);
    });

    it("cuenta los extintores de la sede y cuántos tienen un vencimiento vencido", async () => {
      const site = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra Extintores" })).id;
      const mk = (n: number, last: string) =>
        createAsset({
          tenantId: a,
          actorUserId: inspector,
          typeKey: "extinguisher",
          code: `OB${stamp % 100000}-${n}`,
          description: "Extintor",
          siteId: site,
          attributes: { agent: "abc", capacityKg: 5, manufacturedAt: addMonths(todayIso(), -6) },
          dueDates: [{ kind: "maintenance", lastDoneAt: last }],
        });
      await mk(1, todayIso());
      await mk(2, addMonths(todayIso(), -18));
      expect(await siteExtinguisherStatus(a, site)).toEqual({ total: 2, expired: 1 });
      expect(await siteExtinguisherStatus(b, site)).toEqual({ total: 0, expired: 0 });
    });

    it("aislamiento: las inspecciones de área de una empresa no aparecen en la otra", async () => {
      expect(await db.inspection.count({ where: { tenantId: b, assetId: null } })).toBe(0);
      expect(await db.inspectionPlan.count({ where: { tenantId: b } })).toBe(0);
    });
  });

  describe("arneses y cabos de vida", () => {
    const harness = (extra: Record<string, unknown> = {}) => ({ kind: "harness", serialNumber: "SN-77", manufacturedAt: addMonths(todayIso(), -12), serviceLifeYears: 5, ...extra });
    const newHarness = (attributes = harness(), dueDates: { kind: string; dueAt?: string }[] = []) =>
      createAsset({ tenantId: a, actorUserId: inspector, typeKey: "fall_protection", code: `ARN${stamp % 100000}-${++seq}`, description: "Arnés de cuadrilla", siteId: siteA, attributes, dueDates });

    it("el alta calcula el fin de la vida útil (fabricación + años), deja su aviso y el programa semestral", async () => {
      const asset = await newHarness();
      const due = await db.assetDueDate.findFirstOrThrow({ where: { assetId: asset.id, kind: "service_life_end" } });
      expect(isoFromDate(due.dueAt)).toBe(addMonths(addMonths(todayIso(), -12), 60));
      expect(due).toMatchObject({ blocking: true, leadDays: 30 });
      expect(await db.dueItem.count({ where: { tenantId: a, entityType: "asset_due_date", entityId: due.id, status: "open" } })).toBe(1);
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, assetId: asset.id } });
      expect(isoFromDate(plan.nextDueAt!)).toBe(addMonths(todayIso(), 6));
    });

    it("rechaza un arnés sin n.º de serie o sin fabricación", async () => {
      await expect(newHarness({ kind: "harness", manufacturedAt: "2024-01-01" } as never)).rejects.toThrow(/serie/);
      await expect(newHarness({ kind: "harness", serialNumber: "S" } as never)).rejects.toThrow(/fecha|Fecha|Required|expected/i);
    });

    it("la inspección trae los ítems que corresponden al tipo y completa sola la vida útil vigente", async () => {
      const harnessAsset = await newHarness();
      const retractable = await newHarness(harness({ kind: "retractable" }));
      const lanyard = await newHarness(harness({ kind: "lanyard_single" }));
      const codesOf = async (assetId: string) => {
        const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId });
        return (await getInspectionView(a, id))!.items;
      };
      const h = await codesOf(harnessAsset.id);
      expect(h).toHaveLength(11);
      expect(h.map((i) => i.item.code)).toContain("harness_antitrauma");
      expect(h.map((i) => i.item.code)).not.toContain("retractable_brake");
      expect(h.find((i) => i.item.code === "ident_service_life")!.answer).toMatchObject({ autoDerived: true, value: "conform" });
      expect((await codesOf(retractable.id)).map((i) => i.item.code)).toContain("retractable_brake");
      expect(await codesOf(lanyard.id)).toHaveLength(10);
    });

    it("no apto: baja definitiva con su evento, programa cerrado, sin vencimientos futuros, acción de destrucción y sin hallazgo", async () => {
      const asset = await newHarness();
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
      await fill(a, id, ["webbing_cuts"]);
      await close(id);
      const after = await db.asset.findUniqueOrThrow({ where: { id: asset.id } });
      expect(after).toMatchObject({ status: "retired", statusReason: "Inspección no apta: baja definitiva" });
      expect(after.retiredAt).not.toBeNull();
      const event = await db.assetStatusEvent.findFirstOrThrow({ where: { assetId: asset.id, inspectionId: id } });
      expect(event).toMatchObject({ fromStatus: "in_service", toStatus: "retired", reasonCode: "inspection_unfit_retired" });
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, assetId: asset.id } });
      expect(plan).toMatchObject({ active: false, nextDueAt: null });
      const lifeDue = await db.assetDueDate.findFirstOrThrow({ where: { assetId: asset.id } });
      expect(await db.dueItem.count({ where: { tenantId: a, status: "open", entityId: { in: [plan.id, lifeDue.id] } } })).toBe(0);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { action: true } });
      expect(inspection).toMatchObject({ result: "unfit", findingId: null });
      expect(inspection.action!.description).toContain("destruirlo y adjuntar la foto");
      expect(todayIso(inspection.action!.dueAt!)).toBe(addDays(todayIso(), 2));
    });

    it("un arnés dado de baja no se puede volver a inspeccionar", async () => {
      const asset = await newHarness();
      await retireAsset({ tenantId: a, actorUserId: inspector, assetId: asset.id, reason: "Se perdió en obra" });
      await expect(startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id })).rejects.toThrow(/baja/);
    });

    it("con la vida útil vencida el cierre da no apto y lo da de baja aunque todo lo demás esté conforme", async () => {
      const asset = await newHarness(harness({ manufacturedAt: addMonths(todayIso(), -80) }));
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
      const view = (await getInspectionView(a, id))!;
      expect(view.items.find((i) => i.item.code === "ident_service_life")!.answer.value).toBe("nonconform");
      await fill(a, id);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection).toMatchObject({ result: "unfit", nonconformCount: 1 });
      expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe("retired");
    });

    it("la fecha del fabricante manda sobre la calculada y renovar no aplica: se carga al alta", async () => {
      const asset = await newHarness(harness(), [{ kind: "service_life_end", dueAt: addDays(todayIso(), 100) }]);
      const due = await db.assetDueDate.findFirstOrThrow({ where: { assetId: asset.id } });
      expect(isoFromDate(due.dueAt)).toBe(addDays(todayIso(), 100));
    });

    it("importa arneses por CSV (con un error) y reimportar no duplica", async () => {
      const csv = [
        "codigo,descripcion,sede,tipo_equipo,serie,fabricacion,vida_util_anios",
        `CSV${stamp % 100000}-1,Arnés 1,Obra Norte,arnés de cuerpo completo,S1,${addMonths(todayIso(), -10)},`,
        `CSV${stamp % 100000}-2,Cabo 2,Obra Norte,cabo simple con absorbedor,S2,${addMonths(todayIso(), -10)},7`,
        `CSV${stamp % 100000}-3,Sede mala,No existe,retráctil,S3,${addMonths(todayIso(), -10)},5`,
      ].join("\n");
      const preview = await previewAssetImport(a, "fall_protection", csv);
      expect(preview.items.filter((i) => i.action === "create")).toHaveLength(2);
      expect(preview.items.filter((i) => i.action === "error")).toHaveLength(1);
      await applyAssetImport({ tenantId: a, actorUserId: inspector, typeKey: "fall_protection", csv });
      const again = await previewAssetImport(a, "fall_protection", csv);
      expect(again.items.filter((i) => i.action === "create")).toHaveLength(0);
      expect(await db.asset.count({ where: { tenantId: a, typeKey: "fall_protection", code: { startsWith: `CSV${stamp % 100000}-` } } })).toBe(2);
      const seven = await db.asset.findFirstOrThrow({ where: { tenantId: a, code: `CSV${stamp % 100000}-2` }, include: { dueDates: true } });
      expect(isoFromDate(seven.dueDates[0].dueAt)).toBe(addMonths(addMonths(todayIso(), -10), 84));
    });

    it("aislamiento: la otra empresa no ve los arneses", async () => {
      expect(await db.asset.count({ where: { tenantId: b, typeKey: "fall_protection" } })).toBe(0);
    });
  });
});
