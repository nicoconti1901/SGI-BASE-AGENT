import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { applyAssetImport, createAsset, previewAssetImport } from "@/lib/assets";
import { addInspectionPhoto, closeInspection, getInspectionView, saveAnswer, startInspection } from "@/lib/inspections";
import { lastPreUseControl } from "@/lib/inspection-preuse";
import { InspectionError } from "@/lib/inspection-support";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { addDays, addMonths, isoFromDate, todayIso } from "@/domain/inspections/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("equipos y vehículos pesados: control previo y mensual (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let inspector = "";
  let siteA = "";
  let siteB = "";
  let seq = 0;

  const future = (days: number) => addDays(todayIso(), days);
  const basic = (days = 100) => [
    { kind: "insurance", dueAt: future(days) },
    { kind: "service", dueAt: future(days) },
  ];
  const withRoad = (days = 100) => [...basic(days), { kind: "rto", dueAt: future(days) }];
  const withLifting = (days = 100) => [
    ...withRoad(days),
    { kind: "lifting_certification", dueAt: future(days) },
    { kind: "lifting_review", dueAt: future(days) },
  ];

  async function newEquipment(over: { attributes?: Record<string, unknown>; dueDates?: { kind: string; dueAt?: string }[]; tenant?: string; site?: string } = {}) {
    const n = ++seq;
    return createAsset({
      tenantId: over.tenant ?? a,
      actorUserId: inspector,
      typeKey: "heavy_equipment",
      code: `P${stamp % 100000}-${n}`,
      description: `Equipo ${n}`,
      siteId: over.site ?? siteA,
      attributes: { kind: "backhoe", brand: "Case", model: "580", year: 2019, circulatesOnPublicRoad: false, hasLiftingGear: false, ...(over.attributes ?? {}) },
      dueDates: over.dueDates ?? basic(),
    });
  }
  const newCrane = () =>
    newEquipment({ attributes: { kind: "hydro_crane", circulatesOnPublicRoad: true, hasLiftingGear: true }, dueDates: withLifting() });

  /** Responde todo «conforme» salvo lo indicado; lectura con un valor sano; NC crítica o mayor con comentario y foto. */
  async function fill(inspectionId: string, nonconform: string[] = [], reading = 4_500) {
    const view = (await getInspectionView(a, inspectionId))!;
    for (const row of view.items.filter((i) => !i.answer.autoDerived)) {
      const base = { tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId, itemId: row.item.id };
      if (row.item.kind === "reading") {
        await saveAnswer({ ...base, patch: { numberValue: reading } });
        continue;
      }
      const bad = nonconform.includes(row.item.code);
      await saveAnswer({ ...base, patch: { value: bad ? "nonconform" : "conform", ...(bad ? { comment: "Se ve mal" } : {}) } });
      if (bad && row.item.photoOnNc) {
        await addInspectionPhoto({ ...base, fileName: "f.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage });
      }
    }
  }

  const startPreUse = (assetId: string) => startInspection({ tenantId: a, actorUserId: inspector, assetId, templateKey: "heavy_pre_use" });
  const close = (inspectionId: string, opts: { canRelease?: boolean; confirmLowerReadings?: boolean } = {}) =>
    closeInspection({ tenantId: a, actorUserId: inspector, canEditOthers: opts.canRelease ?? false, inspectionId, confirmLowerReadings: opts.confirmLowerReadings });
  const codes = async (inspectionId: string) =>
    (await db.inspectionAnswer.findMany({ where: { inspectionId }, include: { item: true } })).map((r) => r.item.code);

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Pes ${label}`, slug: `pes-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    inspector = (await db.user.create({ data: { name: "Ivo Inspector", email: `pes-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: inspector, name: "Obra A" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: inspector, name: "Obra B" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: inspector } });
    await db.$disconnect();
  });

  describe("alta del equipo", () => {
    it("deja un vencimiento por documento según circule y tenga izaje, con los bloqueantes marcados", async () => {
      const plain = await newEquipment();
      expect((await db.assetDueDate.findMany({ where: { assetId: plain.id }, orderBy: { kind: "asc" } })).map((d) => [d.kind, d.blocking])).toEqual([
        ["insurance", true],
        ["service", false],
      ]);
      const crane = await newCrane();
      expect((await db.assetDueDate.findMany({ where: { assetId: crane.id }, orderBy: { kind: "asc" } })).map((d) => [d.kind, d.blocking])).toEqual([
        ["insurance", true],
        ["lifting_certification", true],
        ["lifting_review", true],
        ["rto", true],
        ["service", false],
      ]);
    });

    it("exige la RTO si circula y los de izaje si tiene izaje", async () => {
      await expect(newEquipment({ attributes: { circulatesOnPublicRoad: true }, dueDates: basic() })).rejects.toThrow(/RTO/);
      await expect(newEquipment({ attributes: { hasLiftingGear: true }, dueDates: basic() })).rejects.toThrow(/izaje/);
      await expect(newEquipment({ attributes: { kind: "tractor" } })).rejects.toBeInstanceOf(InspectionError);
    });

    it("importa por CSV y reimportar actualiza por código sin duplicar", async () => {
      const code = `PCSV${stamp % 100000}`;
      const csv = [
        "codigo,descripcion,sede,tipo_equipo,circula_via_publica,tiene_izaje,medidor,vence_seguro,vence_service",
        `${code}-1,Retro uno,Obra A,retroexcavadora,no,no,horas,${future(90)},${future(90)}`,
        `${code}-2,Sin seguro,Obra A,camion,no,no,km,,${future(90)}`,
      ].join("\n");
      const preview = await previewAssetImport(a, "heavy_equipment", csv);
      expect(preview.counts.create).toBe(1);
      expect(preview.errors).toHaveLength(1);
      await applyAssetImport({ tenantId: a, actorUserId: inspector, typeKey: "heavy_equipment", csv });
      expect((await previewAssetImport(a, "heavy_equipment", csv)).counts.create).toBe(0);
      const rows = await db.asset.findMany({ where: { tenantId: a, code: `${code}-1` } });
      expect(rows).toHaveLength(1);
      expect(rows[0].attributes).toMatchObject({ kind: "backhoe", meterKind: "hours" });
    });
  });

  describe("control previo al uso", () => {
    it("usa su propia plantilla, sin ítems automáticos; el izaje solo aparece con izaje", async () => {
      const plain = await newEquipment();
      const { id } = await startPreUse(plain.id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { template: true, answers: true } });
      expect(inspection.template.key).toBe("heavy_pre_use");
      expect(inspection.answers).toHaveLength(14); // 13 controles + horómetro
      expect(inspection.answers.some((r) => r.autoDerived)).toBe(false);
      expect(await codes(id)).toContain("reading_hours");

      const crane = await newCrane();
      const lifted = await startPreUse(crane.id);
      expect(await db.inspectionAnswer.count({ where: { inspectionId: lifted.id } })).toBe(18); // 17 controles + horómetro
      expect((await codes(lifted.id)).filter((c) => c.startsWith("lift_"))).toHaveLength(4);
    });

    it("pide el odómetro y no el horómetro cuando el equipo mide en km", async () => {
      const truck = await newEquipment({ attributes: { kind: "truck", circulatesOnPublicRoad: true, meterKind: "odometer" }, dueDates: withRoad() });
      const { id } = await startPreUse(truck.id);
      const c = await codes(id);
      expect(c).toContain("reading_odometer");
      expect(c).not.toContain("reading_hours");
      await fill(id, [], 120_000);
      await close(id);
      expect(await db.inspection.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "closed", result: "fit", readingKm: 120_000, readingHours: null });
    });

    it("cerrar apto: copia el horómetro, no crea programa ni vencimientos y se muestra «hoy»", async () => {
      const e = await newEquipment();
      const { id } = await startPreUse(e.id);
      await fill(id, [], 4_520.5);
      const first = await close(id);
      expect(first.alreadyClosed).toBe(false);
      expect((await close(id)).alreadyClosed).toBe(true);
      expect(await db.inspection.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "closed", result: "fit", readingHours: 4_520.5, readingKm: null, actionId: null, findingId: null });
      expect(await db.inspectionPlan.count({ where: { tenantId: a, assetId: e.id, template: { key: "heavy_pre_use" } } })).toBe(0);
      expect((await db.asset.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("in_service");
      expect(await lastPreUseControl(a, e.id, "heavy_pre_use")).toMatchObject({ id, inspectedAt: todayIso(), daysAgo: 0, result: "fit" });
    });

    it("un horómetro menor que el anterior exige confirmación", async () => {
      const e = await newEquipment();
      const first = await startPreUse(e.id);
      await fill(first.id, [], 5_000);
      await close(first.id);
      const second = await startPreUse(e.id);
      await fill(second.id, [], 4_900);
      await expect(close(second.id)).rejects.toThrow(/menor que la anterior/);
      expect((await close(second.id, { confirmLowerReadings: true })).alreadyClosed).toBe(false);
    });

    it("con una crítica de izaje: equipo fuera de servicio, una acción y un hallazgo borrador, una sola vez", async () => {
      const crane = await newCrane();
      const { id } = await startPreUse(crane.id);
      await fill(id, ["lift_hooks_slings"]);
      await close(id);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection.result).toBe("unfit");
      expect(inspection.actionId).toBeTruthy();
      expect(inspection.findingId).toBeTruthy();
      expect(await db.finding.findUniqueOrThrow({ where: { id: inspection.findingId! } })).toMatchObject({ tenantId: a, origin: "inspection" });
      expect((await db.asset.findUniqueOrThrow({ where: { id: crane.id } })).status).toBe("out_of_service");
      expect(await db.assetStatusEvent.count({ where: { assetId: crane.id, inspectionId: id } })).toBe(1);
    });

    it("un control previo apto nunca libera un equipo que dejó parado SST, aunque lo cierre quien puede liberar", async () => {
      const e = await newEquipment();
      const bad = await startInspection({ tenantId: a, actorUserId: inspector, assetId: e.id });
      await fill(bad.id, ["ms_brakes_steering"]);
      await close(bad.id);
      expect((await db.asset.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("out_of_service");
      const pre = await startPreUse(e.id);
      await fill(pre.id);
      await close(pre.id, { canRelease: true });
      expect((await db.asset.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("out_of_service");
    });
  });

  describe("inspección mensual", () => {
    it("trae seguro y service automáticos, sin RTO ni izaje, y se programa al mes con aviso a 7 días", async () => {
      const e = await newEquipment();
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: e.id });
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { template: true, answers: { include: { item: true } } } });
      expect(inspection.template.key).toBe("heavy_periodic");
      expect(inspection.answers).toHaveLength(12); // 11 controles + horómetro
      expect(inspection.answers.filter((r) => r.autoDerived).map((r) => r.item.code).sort()).toEqual(["docs_insurance", "docs_service"]);
      await fill(id);
      await close(id);
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, assetId: e.id, template: { key: "heavy_periodic" } } });
      expect(plan).toMatchObject({ lastResult: "fit", active: true });
      expect(isoFromDate(plan.nextDueAt!)).toBe(addMonths(todayIso(), 1));
      const dues = await db.dueItem.findMany({ where: { tenantId: a, entityType: "inspection_plan", entityId: plan.id, status: "open" } });
      expect(dues).toHaveLength(1);
      expect(dues[0].leadDays).toBe(7);
    });

    it("con izaje y vía pública aplican los 19 controles y los cinco documentos automáticos", async () => {
      const crane = await newCrane();
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: crane.id });
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { answers: true } });
      expect(inspection.answers).toHaveLength(20);
      expect(inspection.answers.filter((r) => r.autoDerived)).toHaveLength(5);
    });

    it("con la revisión de izaje vencida nace no conforme: no apta, con hallazgo borrador y reinspección a 7 días", async () => {
      const crane = await newEquipment({
        attributes: { kind: "crane", circulatesOnPublicRoad: true, hasLiftingGear: true },
        dueDates: [...withRoad(), { kind: "lifting_certification", dueAt: future(100) }, { kind: "lifting_review", dueAt: addDays(todayIso(), -2) }],
      });
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: crane.id });
      await fill(id);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection.result).toBe("unfit");
      expect(inspection.actionId).toBeTruthy();
      expect(inspection.findingId).toBeTruthy();
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, assetId: crane.id, template: { key: "heavy_periodic" } } });
      expect(isoFromDate(plan.nextDueAt!)).toBe(addDays(todayIso(), 7));
      expect((await db.asset.findUniqueOrThrow({ where: { id: crane.id } })).status).toBe("out_of_service");
    });

    it("la reinspección apta libera al equipo solo si quien cierra puede liberar", async () => {
      const e = await newEquipment();
      const bad = await startInspection({ tenantId: a, actorUserId: inspector, assetId: e.id });
      await fill(bad.id, ["ms_inertial_belt"]);
      await close(bad.id);
      expect((await db.asset.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("out_of_service");

      const noRelease = await startInspection({ tenantId: a, actorUserId: inspector, assetId: e.id });
      await fill(noRelease.id);
      await close(noRelease.id, { canRelease: false });
      expect((await db.asset.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("out_of_service");

      const release = await startInspection({ tenantId: a, actorUserId: inspector, assetId: e.id });
      await fill(release.id);
      await close(release.id, { canRelease: true });
      expect((await db.asset.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("in_service");
    });
  });

  describe("aislamiento y baja", () => {
    it("otra empresa no puede inspeccionar ni leer el equipo, ni su último control previo", async () => {
      const e = await newEquipment();
      await expect(startInspection({ tenantId: b, actorUserId: inspector, assetId: e.id, templateKey: "heavy_pre_use" })).rejects.toThrow(/Activo no encontrado/);
      const mine = await startPreUse(e.id);
      await fill(mine.id);
      await close(mine.id);
      expect(await lastPreUseControl(b, e.id, "heavy_pre_use")).toBeNull();
      expect(await lastPreUseControl(a, e.id, "heavy_pre_use")).not.toBeNull();
      const other = await newEquipment({ tenant: b, site: siteB });
      expect((await db.asset.findUniqueOrThrow({ where: { id: other.id } })).tenantId).toBe(b);
      await expect(startPreUse(other.id)).rejects.toThrow(/Activo no encontrado/);
    });

    it("no se puede hacer un control previo sobre un equipo dado de baja", async () => {
      const e = await newEquipment();
      await db.asset.update({ where: { id: e.id }, data: { status: "retired", retiredAt: new Date() } });
      await expect(startPreUse(e.id)).rejects.toThrow(/dado de baja/);
    });
  });
});
