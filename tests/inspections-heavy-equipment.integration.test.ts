import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { applyAssetImport, createAsset, previewAssetImport } from "@/lib/assets";
import { addInspectionPhoto, closeInspection, getInspectionView, saveAnswer, startInspection } from "@/lib/inspections";
import { lastPreUseControl } from "@/lib/inspection-preuse";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { addDays, todayIso } from "@/domain/inspections/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("equipos pesados: control previo y mensual (integración)", () => {
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
  const baseDues = () => [
    { kind: "insurance", dueAt: future(200) },
    { kind: "service", dueAt: future(100) },
  ];
  const liftingDues = (reviewDays = 60) => [
    { kind: "lifting_certification", dueAt: future(200) },
    { kind: "lifting_review", dueAt: future(reviewDays) },
  ];

  async function newEquipment(over: { attributes?: Record<string, unknown>; dueDates?: { kind: string; dueAt?: string }[]; tenant?: string; site?: string } = {}) {
    const n = ++seq;
    return createAsset({
      tenantId: over.tenant ?? a,
      actorUserId: inspector,
      typeKey: "heavy_equipment",
      code: `EQ${stamp % 100000}-${n}`,
      description: `Equipo ${n}`,
      siteId: over.site ?? siteA,
      attributes: { equipmentKind: "backhoe", brand: "Case", ...(over.attributes ?? {}) },
      dueDates: over.dueDates ?? baseDues(),
    });
  }
  const newCrane = (reviewDays = 60) => newEquipment({ attributes: { equipmentKind: "crane", hasLiftingGear: true }, dueDates: [...baseDues(), ...liftingDues(reviewDays)] });

  async function fill(inspectionId: string, nonconform: string[] = []) {
    const view = (await getInspectionView(a, inspectionId))!;
    for (const row of view.items.filter((i) => !i.answer.autoDerived)) {
      const base = { tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId, itemId: row.item.id };
      if (row.item.kind === "reading") {
        await saveAnswer({ ...base, patch: { numberValue: 3_200 } });
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
  const startPeriodic = (assetId: string) => startInspection({ tenantId: a, actorUserId: inspector, assetId });
  const close = (inspectionId: string, canRelease = false) => closeInspection({ tenantId: a, actorUserId: inspector, canEditOthers: canRelease, inspectionId });
  const status = async (assetId: string) => (await db.asset.findUniqueOrThrow({ where: { id: assetId } })).status;

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Pes ${label}`, slug: `pes-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    inspector = (await db.user.create({ data: { name: "Ivo Inspector", email: `pes-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: inspector, name: "Base A" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: inspector, name: "Base B" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: inspector } });
    await db.$disconnect();
  });

  describe("alta del equipo", () => {
    it("pide RTO solo si circula y las revisiones de izaje solo si tiene izaje", async () => {
      await expect(newEquipment({ attributes: { circulatesOnPublicRoad: true } })).rejects.toThrow(/RTO/);
      await expect(newEquipment({ attributes: { hasLiftingGear: true } })).rejects.toThrow(/izaje/i);
      const both = await newEquipment({
        attributes: { equipmentKind: "hydro_crane", circulatesOnPublicRoad: true, hasLiftingGear: true },
        dueDates: [...baseDues(), { kind: "rto", dueAt: future(100) }, ...liftingDues()],
      });
      const dues = await db.assetDueDate.findMany({ where: { assetId: both.id }, orderBy: { kind: "asc" } });
      expect(dues.map((d) => [d.kind, d.blocking])).toEqual([
        ["insurance", true],
        ["lifting_certification", true],
        ["lifting_review", true],
        ["rto", true],
        ["service", false],
      ]);
    });

    it("rechaza un tipo de equipo inválido", async () => {
      await expect(newEquipment({ attributes: { equipmentKind: "dragon" } })).rejects.toThrow();
    });

    it("importa por CSV y reimportar actualiza por código sin duplicar", async () => {
      const code = `CSV${stamp % 100000}`;
      const csv = [
        "codigo,descripcion,sede,tipo_equipo,tiene_izaje,vence_seguro,vence_service,vence_certificacion_izaje,vence_revision_izaje",
        `${code}-1,Grúa móvil,Base A,Grúa,sí,${future(90)},${future(90)},${future(90)},${future(60)}`,
        `${code}-2,Sin revisión,Base A,Grúa,sí,${future(90)},${future(90)},${future(90)},`,
      ].join("\n");
      const preview = await previewAssetImport(a, "heavy_equipment", csv);
      expect(preview.counts.create).toBe(1);
      expect(preview.errors).toHaveLength(1);
      await applyAssetImport({ tenantId: a, actorUserId: inspector, typeKey: "heavy_equipment", csv });
      expect((await previewAssetImport(a, "heavy_equipment", csv)).counts.create).toBe(0);
      const rows = await db.asset.findMany({ where: { tenantId: a, code: `${code}-1` } });
      expect(rows).toHaveLength(1);
      expect(rows[0].attributes).toMatchObject({ equipmentKind: "crane", hasLiftingGear: true });
    });
  });

  describe("control previo al uso", () => {
    it("el ítem de izaje solo aparece en equipos con izaje", async () => {
      const plain = await startPreUse((await newEquipment()).id);
      const lifting = await startPreUse((await newCrane()).id);
      expect(await db.inspectionAnswer.count({ where: { inspectionId: plain.id } })).toBe(14);
      expect(await db.inspectionAnswer.count({ where: { inspectionId: lifting.id } })).toBe(18);
      const template = await db.inspection.findUniqueOrThrow({ where: { id: lifting.id }, include: { template: true } });
      expect(template.template.key).toBe("heavy_pre_use");
    });

    it("cerrar apto: copia el horómetro, no crea programa ni vencimientos y no libera", async () => {
      const eq = await newEquipment();
      const { id } = await startPreUse(eq.id);
      await fill(id);
      await close(id);
      const closed = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(closed).toMatchObject({ status: "closed", result: "fit", actionId: null, findingId: null });
      expect(Number(closed.readingHours)).toBe(3200);
      expect(await db.inspectionPlan.count({ where: { tenantId: a, assetId: eq.id, template: { key: "heavy_pre_use" } } })).toBe(0);
      expect(await lastPreUseControl(a, eq.id, "heavy_pre_use")).toMatchObject({ id, daysAgo: 0, result: "fit" });
    });

    it("con una crítica de izaje: fuera de servicio, una acción y un hallazgo borrador; un control previo apto no lo libera", async () => {
      const crane = await newCrane();
      const { id } = await startPreUse(crane.id);
      await fill(id, ["lift_load_limiter"]);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection).toMatchObject({ result: "unfit" });
      expect(inspection.actionId).toBeTruthy();
      expect(inspection.findingId).toBeTruthy();
      expect(await status(crane.id)).toBe("out_of_service");

      const again = await startPreUse(crane.id);
      await fill(again.id);
      await close(again.id, true);
      expect(await status(crane.id)).toBe("out_of_service");
    });
  });

  describe("inspección mensual", () => {
    it("trae seguro y service automáticos (y los de izaje solo si tiene) y se programa al mes", async () => {
      const plain = await startPeriodic((await newEquipment()).id);
      const plainRows = await db.inspectionAnswer.findMany({ where: { inspectionId: plain.id }, include: { item: true } });
      expect(plainRows.filter((r) => r.autoDerived).map((r) => r.item.code).sort()).toEqual(["docs_insurance", "docs_service"]);

      const crane = await newCrane();
      const { id } = await startPeriodic(crane.id);
      const rows = await db.inspectionAnswer.findMany({ where: { inspectionId: id }, include: { item: true } });
      expect(rows.filter((r) => r.autoDerived).map((r) => r.item.code).sort()).toEqual(["docs_insurance", "docs_lifting_certification", "docs_lifting_review", "docs_service"]);
      await fill(id);
      await close(id);
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, assetId: crane.id } });
      expect(plan).toMatchObject({ lastResult: "fit", active: true });
      expect(await db.dueItem.count({ where: { tenantId: a, entityType: "inspection_plan", entityId: plan.id, status: "open" } })).toBe(1);
    });

    it("con la revisión trimestral de izaje vencida nace no conforme: no apta, hallazgo borrador y reinspección a 7 días", async () => {
      const crane = await newCrane(-5);
      const { id } = await startPeriodic(crane.id);
      await fill(id);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection).toMatchObject({ result: "unfit" });
      expect(inspection.actionId).toBeTruthy();
      expect(inspection.findingId).toBeTruthy();
      expect(await status(crane.id)).toBe("out_of_service");
    });

    it("la reinspección apta libera el equipo solo si quien cierra puede liberar", async () => {
      const eq = await newEquipment();
      const bad = await startPeriodic(eq.id);
      await fill(bad.id, ["ms_brakes_steering"]);
      await close(bad.id);
      expect(await status(eq.id)).toBe("out_of_service");

      const noRelease = await startPeriodic(eq.id);
      await fill(noRelease.id);
      await close(noRelease.id, false);
      expect(await status(eq.id)).toBe("out_of_service");

      const release = await startPeriodic(eq.id);
      await fill(release.id);
      await close(release.id, true);
      expect(await status(eq.id)).toBe("in_service");
    });
  });

  describe("aislamiento", () => {
    it("otra empresa no puede inspeccionar ni leer el equipo, ni su último control previo", async () => {
      const eq = await newEquipment();
      await expect(startInspection({ tenantId: b, actorUserId: inspector, assetId: eq.id, templateKey: "heavy_pre_use" })).rejects.toThrow(/Activo no encontrado/);
      const mine = await startPreUse(eq.id);
      await fill(mine.id);
      await close(mine.id);
      expect(await lastPreUseControl(b, eq.id, "heavy_pre_use")).toBeNull();
      expect(await lastPreUseControl(a, eq.id, "heavy_pre_use")).not.toBeNull();
      const other = await newEquipment({ tenant: b, site: siteB });
      expect((await db.asset.findUniqueOrThrow({ where: { id: other.id } })).tenantId).toBe(b);
      await expect(startPreUse(other.id)).rejects.toThrow(/Activo no encontrado/);
    });
  });
});
