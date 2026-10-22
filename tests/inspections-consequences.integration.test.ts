import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { createAsset } from "@/lib/assets";
import { addInspectionPhoto, closeInspection, correctInspectionAnswer, getInspectionView, saveAnswer, startInspection } from "@/lib/inspections";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { ACTION_ENTITY_TYPE } from "@/domain/actions/types";
import { addDays, addMonths, isoFromDate, todayIso } from "@/domain/inspections/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("consecuencias de cerrar una inspección (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let inspector = "";
  let responsible = "";
  let outsider = "";
  let siteA = "";
  let seq = 0;

  const attrs = { agent: "abc", capacityKg: 5, manufacturedAt: "2022-05-10" };
  const newAsset = () =>
    createAsset({
      tenantId: a,
      actorUserId: inspector,
      typeKey: "extinguisher",
      code: `C${stamp % 100000}-${++seq}`,
      description: "Pasillo",
      siteId: siteA,
      attributes: attrs,
      dueDates: [{ kind: "maintenance", lastDoneAt: "2026-03-31" }],
    });

  const itemId = async (inspectionId: string, code: string) => (await getInspectionView(a, inspectionId))!.items.find((i) => i.item.code === code)!.item.id;

  /** Responde todo «conforme» salvo lo indicado; una no conformidad crítica o mayor lleva comentario y foto. */
  async function fill(inspectionId: string, nonconform: string[] = []) {
    const view = (await getInspectionView(a, inspectionId))!;
    for (const row of view.items.filter((i) => !i.answer.autoDerived)) {
      const bad = nonconform.includes(row.item.code);
      await saveAnswer({
        tenantId: a,
        actorUserId: inspector,
        canEditOthers: false,
        inspectionId,
        itemId: row.item.id,
        patch: { value: bad ? "nonconform" : "conform", ...(bad ? { comment: "Se ve mal" } : {}) },
      });
      if (bad && row.item.photoOnNc) {
        await addInspectionPhoto({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId, itemId: row.item.id, fileName: "f.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage });
      }
    }
  }

  async function inspect(assetId: string, nonconform: string[] = [], opts: { canRelease?: boolean; followUp?: { ownerUserId?: string; dueAt?: string } } = {}) {
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId });
    await fill(id, nonconform);
    const outcome = await closeInspection({ tenantId: a, actorUserId: inspector, canEditOthers: opts.canRelease ?? false, inspectionId: id, followUp: opts.followUp });
    return { id, outcome };
  }

  const planOf = (assetId: string) => db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, assetId } });
  const openPlanDues = async (planId: string) => db.dueItem.findMany({ where: { tenantId: a, entityType: "inspection_plan", entityId: planId, status: "open" } });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `InspC ${label}`, slug: `inspc-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    inspector = (await db.user.create({ data: { name: "Inés Inspectora", email: `inspc-${stamp}@test.dev`, emailVerified: true } })).id;
    responsible = (await db.user.create({ data: { name: "Rita Responsable", email: `inspc-r-${stamp}@test.dev`, emailVerified: true } })).id;
    outsider = (await db.user.create({ data: { name: "Ajeno", email: `inspc-x-${stamp}@test.dev`, emailVerified: true } })).id;
    await db.membership.create({ data: { tenantId: a, userId: responsible, role: "process_owner" } });
    siteA = (await createSite({ tenantId: a, actorUserId: inspector, name: "Base" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [inspector, responsible, outsider] } } });
    await db.$disconnect();
  });

  it("apta: el calendario se reinicia, queda un solo vencimiento y no se crea ninguna acción", async () => {
    const asset = await newAsset();
    const { id } = await inspect(asset.id);
    const plan = await planOf(asset.id);
    expect(plan).toMatchObject({ lastInspectionId: id, lastResult: "fit", active: true });
    expect(isoFromDate(plan.nextDueAt!)).toBe(addMonths(todayIso(), 1));
    expect(await openPlanDues(plan.id)).toHaveLength(1);
    const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
    expect(inspection).toMatchObject({ actionId: null, findingId: null });
    expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe("in_service");
  });

  it("no apta: fuera de servicio con su evento, reinspección en 7 días y acción con plazo de 48 h", async () => {
    const asset = await newAsset();
    const { id } = await inspect(asset.id, ["state_seal"]);

    const after = await db.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(after).toMatchObject({ status: "out_of_service", statusReason: "Inspección no apta" });
    const events = await db.assetStatusEvent.findMany({ where: { assetId: asset.id, inspectionId: id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: "in_service", toStatus: "out_of_service", reasonCode: "inspection_unfit", byUserId: inspector });

    const plan = await planOf(asset.id);
    expect(plan.lastResult).toBe("unfit");
    expect(isoFromDate(plan.nextDueAt!)).toBe(addDays(todayIso(), 7));
    const dues = await openPlanDues(plan.id);
    expect(dues).toHaveLength(1);
    expect(dues[0].title).toMatch(/^Reinspección/);

    const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { action: true } });
    expect(inspection.findingId).toBeNull(); // extintores: sin hallazgo
    expect(inspection.action).toMatchObject({ ownerUserId: inspector, status: "open" });
    expect(inspection.action!.description).toContain("Precinto");
    expect(inspection.action!.description).toContain("Reponer el extintor");
    expect(todayIso(inspection.action!.dueAt!)).toBe(addDays(todayIso(), 2));
    const actionDue = await db.dueItem.findMany({ where: { tenantId: a, entityType: ACTION_ENTITY_TYPE, entityId: inspection.actionId!, status: "open" } });
    expect(actionDue).toHaveLength(1);
    expect(actionDue[0]).toMatchObject({ ownerUserId: inspector, siteId: siteA });
  });

  it("una no conformidad menor: acción a 30 días y el activo sigue en servicio", async () => {
    const asset = await newAsset();
    const { id } = await inspect(asset.id, ["loc_mount"]);
    const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { action: true } });
    expect(inspection.result).toBe("fit_with_observations");
    expect(todayIso(inspection.action!.dueAt!)).toBe(addDays(todayIso(), 30));
    expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe("in_service");
    expect(await db.assetStatusEvent.count({ where: { assetId: asset.id, inspectionId: id } })).toBe(0);
  });

  it("el inspector puede elegir responsable y plazo; un responsable ajeno a la empresa se rechaza", async () => {
    const asset = await newAsset();
    const due = addDays(todayIso(), 10);
    const { id } = await inspect(asset.id, ["loc_mount"], { followUp: { ownerUserId: responsible, dueAt: due } });
    const action = await db.action.findUniqueOrThrow({ where: { id: (await db.inspection.findUniqueOrThrow({ where: { id } })).actionId! } });
    expect(action.ownerUserId).toBe(responsible);
    expect(todayIso(action.dueAt!)).toBe(due);

    const other = await newAsset();
    const started = await startInspection({ tenantId: a, actorUserId: inspector, assetId: other.id });
    await fill(started.id, ["loc_mount"]);
    await expect(closeInspection({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: started.id, followUp: { ownerUserId: outsider } })).rejects.toThrow("no pertenece");
    expect((await db.inspection.findUniqueOrThrow({ where: { id: started.id } })).status).toBe("draft"); // la transacción se deshizo entera
  });

  it("cerrar dos pedidos a la vez deja una sola acción y un solo vencimiento abierto", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    await fill(id, ["state_seal"]);
    const close = () => closeInspection({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id });
    const outcomes = await Promise.all([close(), close(), close()]);
    expect(outcomes.filter((o) => !o.alreadyClosed)).toHaveLength(1);
    expect(await db.action.count({ where: { tenantId: a, inspection: { id } } })).toBe(1);
    expect(await db.assetStatusEvent.count({ where: { assetId: asset.id, inspectionId: id } })).toBe(1);
    expect(await openPlanDues((await planOf(asset.id)).id)).toHaveLength(1);
  });

  it("si la plantilla lo pide, una no conformidad crítica crea además un hallazgo en borrador vinculado", async () => {
    const template = await db.inspectionTemplate.findFirstOrThrow({ where: { tenantId: a, key: "extinguisher_periodic" } });
    await db.inspectionTemplate.update({ where: { id: template.id }, data: { findingOnCritical: true } });
    try {
      const asset = await newAsset();
      const { id } = await inspect(asset.id, ["state_seal", "loc_mount"]);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { finding: true, action: { include: { links: true } } } });
      expect(inspection.finding).toMatchObject({ status: "draft", origin: "inspection", type: "nonconformity", severity: "Crítica", createdByUserId: inspector });
      expect(inspection.finding!.description).toContain("Precinto");
      expect(inspection.finding!.description).not.toContain("Soporte"); // solo las críticas
      expect(inspection.action!.links).toMatchObject([{ targetType: "finding", targetId: inspection.findingId }]);
    } finally {
      await db.inspectionTemplate.update({ where: { id: template.id }, data: { findingOnCritical: false } });
    }
  });

  describe("reinspección de un activo fuera de servicio", () => {
    it("apta por un responsable de proceso: vuelve a servicio", async () => {
      const asset = await newAsset();
      await inspect(asset.id, ["state_seal"]);
      const { id } = await inspect(asset.id, [], { canRelease: true });
      const after = await db.asset.findUniqueOrThrow({ where: { id: asset.id } });
      expect(after).toMatchObject({ status: "in_service", statusReason: "Reinspección apta: vuelve a servicio" });
      expect(await db.assetStatusEvent.count({ where: { assetId: asset.id, inspectionId: id, reasonCode: "reinstated" } })).toBe(1);
      expect(isoFromDate((await planOf(asset.id)).nextDueAt!)).toBe(addMonths(todayIso(), 1));
    });

    it("apta por quien no puede liberar: queda fuera de servicio pendiente de liberación", async () => {
      const asset = await newAsset();
      await inspect(asset.id, ["state_seal"]);
      await inspect(asset.id, [], { canRelease: false });
      expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe("out_of_service");
      expect((await planOf(asset.id)).lastResult).toBe("fit");
    });

    it("otra no apta no duplica el evento de estado", async () => {
      const asset = await newAsset();
      await inspect(asset.id, ["state_seal"]);
      await inspect(asset.id, ["state_seal"]);
      expect(await db.assetStatusEvent.count({ where: { assetId: asset.id, reasonCode: "inspection_unfit" } })).toBe(1);
    });
  });

  describe("corrección de una inspección cerrada", () => {
    const correct = (inspectionId: string, answerId: string, patch: Parameters<typeof correctInspectionAnswer>[0]["patch"], over: Partial<Parameters<typeof correctInspectionAnswer>[0]> = {}) =>
      correctInspectionAnswer({ tenantId: a, actorUserId: responsible, canRelease: true, inspectionId, answerId, patch, reason: "El inspector se equivocó de ítem", ...over });
    const answerOf = async (inspectionId: string, code: string) => (await db.inspectionAnswer.findFirstOrThrow({ where: { inspectionId, item: { code } } })).id;

    it("empeora la última inspección a no apta: saca el activo de servicio, crea la acción y deja registro", async () => {
      const asset = await newAsset();
      const { id } = await inspect(asset.id);
      const result = await correct(id, await answerOf(id, "state_seal"), { value: "nonconform" });
      expect(result).toMatchObject({ previousResult: "fit", result: "unfit" });

      expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe("out_of_service");
      expect(await db.assetStatusEvent.count({ where: { assetId: asset.id, reasonCode: "correction_unfit" } })).toBe(1);
      const plan = await planOf(asset.id);
      expect(plan.lastResult).toBe("unfit");
      expect(isoFromDate(plan.nextDueAt!)).toBe(addDays(todayIso(), 7));
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection).toMatchObject({ result: "unfit", nonconformCount: 1 });
      expect(inspection.actionId).not.toBeNull();
      const corrections = await db.inspectionCorrection.findMany({ where: { inspectionId: id } });
      expect(corrections).toMatchObject([{ previousValue: "conform", newValue: "nonconform", previousResult: "fit", newResult: "unfit", byUserId: responsible }]);
    });

    it("una corrección que mejora el resultado no libera el activo", async () => {
      const asset = await newAsset();
      const { id } = await inspect(asset.id, ["state_seal"]);
      await correct(id, await answerOf(id, "state_seal"), { value: "conform" });
      expect((await db.inspection.findUniqueOrThrow({ where: { id } })).result).toBe("fit");
      expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe("out_of_service");
    });

    it("sobre una inspección que no es la última no toca el activo ni el programa", async () => {
      const asset = await newAsset();
      const first = await inspect(asset.id);
      await inspect(asset.id);
      await correct(first.id, await answerOf(first.id, "state_seal"), { value: "nonconform" });
      expect((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status).toBe("in_service");
      expect((await planOf(asset.id)).lastResult).toBe("fit");
    });

    it("exige motivo, permiso y un cambio real; no corrige ítems automáticos ni de otra empresa", async () => {
      const asset = await newAsset();
      const { id } = await inspect(asset.id);
      const seal = await answerOf(id, "state_seal");
      await expect(correct(id, seal, { value: "nonconform" }, { reason: "corto" })).rejects.toThrow("motivo");
      await expect(correct(id, seal, { value: "nonconform" }, { canRelease: false })).rejects.toThrow("administrador");
      await expect(correct(id, seal, { value: "conform" })).rejects.toThrow("no cambia");
      await expect(correct(id, await answerOf(id, "docs_hydrostatic"), { value: "nonconform" })).rejects.toThrow("sistema");
      await expect(correctInspectionAnswer({ tenantId: b, actorUserId: responsible, canRelease: true, inspectionId: id, answerId: seal, patch: { value: "nonconform" }, reason: "Intento desde otra empresa" })).rejects.toThrow("no encontrada");
      expect(await db.inspectionCorrection.count({ where: { inspectionId: id } })).toBe(0);
    });

    it("no se corrige un borrador", async () => {
      const asset = await newAsset();
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
      await expect(correct(id, await itemId(id, "state_seal"), { value: "nonconform" })).rejects.toThrow("cerradas");
    });
  });

  it("el hallazgo, la acción y el vencimiento quedan en la empresa de la inspección", async () => {
    const asset = await newAsset();
    const { id } = await inspect(asset.id, ["state_seal"]);
    const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
    expect(await db.action.count({ where: { id: inspection.actionId!, tenantId: a } })).toBe(1);
    expect(await db.action.count({ where: { tenantId: b } })).toBe(0);
    expect(await db.dueItem.count({ where: { tenantId: b } })).toBe(0);
  });
});
