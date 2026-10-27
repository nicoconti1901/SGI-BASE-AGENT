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

describe.skipIf(!hasDatabase)("vehículos livianos: control previo y mensual (integración)", () => {
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

  async function newVehicle(over: { attributes?: Record<string, unknown>; dueDates?: { kind: string; dueAt?: string }[]; tenant?: string; site?: string } = {}) {
    const n = ++seq;
    return createAsset({
      tenantId: over.tenant ?? a,
      actorUserId: inspector,
      typeKey: "light_vehicle",
      code: `V${stamp % 100000}-${n}`,
      description: `Camioneta ${n}`,
      siteId: over.site ?? siteA,
      attributes: { plate: `AB${100 + n}CD`, brand: "Toyota", model: "Hilux", year: 2021, ...(over.attributes ?? {}) },
      dueDates: over.dueDates ?? [
        { kind: "insurance", dueAt: future(200) },
        { kind: "rto", dueAt: future(200) },
        { kind: "service", dueAt: future(100) },
      ],
    });
  }

  /** Responde todo «conforme» salvo lo indicado; lectura y números con valores sanos; NC crítica o mayor con comentario y foto. */
  async function fill(inspectionId: string, nonconform: string[] = [], odometer = 45_000) {
    const view = (await getInspectionView(a, inspectionId))!;
    for (const row of view.items.filter((i) => !i.answer.autoDerived)) {
      const base = { tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId, itemId: row.item.id };
      if (row.item.kind === "reading") {
        await saveAnswer({ ...base, patch: { numberValue: odometer } });
        continue;
      }
      if (row.item.kind === "number") {
        await saveAnswer({ ...base, patch: { numberValue: 6 } });
        continue;
      }
      const bad = nonconform.includes(row.item.code);
      await saveAnswer({ ...base, patch: { value: bad ? "nonconform" : "conform", ...(bad ? { comment: "Se ve mal" } : {}) } });
      if (bad && row.item.photoOnNc) {
        await addInspectionPhoto({ ...base, fileName: "f.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage });
      }
    }
  }

  const startPreUse = (assetId: string) => startInspection({ tenantId: a, actorUserId: inspector, assetId, templateKey: "light_pre_use" });
  const close = (inspectionId: string, opts: { canRelease?: boolean; confirmLowerReadings?: boolean } = {}) =>
    closeInspection({ tenantId: a, actorUserId: inspector, canEditOthers: opts.canRelease ?? false, inspectionId, confirmLowerReadings: opts.confirmLowerReadings });
  /** Programa y vencimientos abiertos del control previo: tiene que haber cero (el calendario es el de la inspección mensual). */
  const openDues = async (assetId: string) => {
    const plans = await db.inspectionPlan.findMany({ where: { tenantId: a, assetId, template: { key: "light_pre_use" } }, select: { id: true } });
    return db.dueItem.count({ where: { tenantId: a, entityType: "inspection_plan", status: "open", entityId: { in: plans.map((p) => p.id) } } });
  };

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Liv ${label}`, slug: `liv-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    inspector = (await db.user.create({ data: { name: "Ivo Inspector", email: `liv-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: inspector, name: "Base A" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: inspector, name: "Base B" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: inspector } });
    await db.$disconnect();
  });

  describe("alta del vehículo", () => {
    it("guarda el dominio normalizado y deja un vencimiento por documento, bloqueantes seguro y RTO", async () => {
      const v = await newVehicle({ attributes: { plate: "ab-123 cd" } });
      expect((v.attributes as { plate: string }).plate).toBe("AB123CD");
      const dues = await db.assetDueDate.findMany({ where: { assetId: v.id }, orderBy: { kind: "asc" } });
      expect(dues.map((d) => [d.kind, d.blocking])).toEqual([
        ["insurance", true],
        ["rto", true],
        ["service", false],
      ]);
    });

    it("pide el monitoreo satelital solo si el vehículo lo tiene", async () => {
      await expect(newVehicle({ attributes: { hasSatelliteMonitoring: true } })).rejects.toThrow(/Monitoreo satelital/);
      const v = await newVehicle({
        attributes: { hasSatelliteMonitoring: true },
        dueDates: [
          { kind: "insurance", dueAt: future(100) },
          { kind: "rto", dueAt: future(100) },
          { kind: "service", dueAt: future(100) },
          { kind: "satellite_monitoring", dueAt: future(100) },
        ],
      });
      expect(await db.assetDueDate.count({ where: { assetId: v.id } })).toBe(4);
    });

    it("rechaza un dominio inválido y falta de seguro", async () => {
      await expect(newVehicle({ attributes: { plate: "x" } })).rejects.toBeInstanceOf(InspectionError);
      await expect(newVehicle({ dueDates: [{ kind: "rto", dueAt: future(10) }, { kind: "service", dueAt: future(10) }] })).rejects.toThrow(/Seguro/);
    });

    it("importa por CSV y reimportar actualiza por código sin duplicar", async () => {
      const code = `CSV${stamp % 100000}`;
      const csv = [
        "codigo,descripcion,sede,dominio,marca,antivuelco,vence_seguro,vence_rto,vence_service",
        `${code}-1,Camioneta uno,Base A,ab 111 cd,Ford,sí,${future(90)},${future(90)},${future(90)}`,
        `${code}-2,Sin seguro,Base A,AB222CD,Ford,no,,${future(90)},${future(90)}`,
      ].join("\n");
      const preview = await previewAssetImport(a, "light_vehicle", csv);
      expect(preview.counts.create).toBe(1);
      expect(preview.errors).toHaveLength(1);
      await applyAssetImport({ tenantId: a, actorUserId: inspector, typeKey: "light_vehicle", csv });
      const again = await previewAssetImport(a, "light_vehicle", csv);
      expect(again.counts.create).toBe(0);
      const rows = await db.asset.findMany({ where: { tenantId: a, code: `${code}-1` } });
      expect(rows).toHaveLength(1);
      expect(rows[0].attributes).toMatchObject({ plate: "AB111CD", hasRollbar: true });
    });
  });

  describe("control previo al uso", () => {
    it("usa su propia plantilla, sin ítems automáticos, y retoma el borrador", async () => {
      const v = await newVehicle();
      const [x, y] = await Promise.all([startPreUse(v.id), startPreUse(v.id)]);
      expect(x.id).toBe(y.id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id: x.id }, include: { template: true, answers: true } });
      expect(inspection.template.key).toBe("light_pre_use");
      expect(inspection.answers).toHaveLength(10);
      expect(inspection.answers.some((r) => r.autoDerived)).toBe(false);
      // El periódico es otro borrador, aparte.
      const periodic = await startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id });
      expect(periodic.id).not.toBe(x.id);
    });

    it("solo admite las plantillas del tipo del activo", async () => {
      const v = await newVehicle();
      await expect(startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id, templateKey: "extinguisher_periodic" })).rejects.toThrow(/no admite/);
      const ext = await createAsset({
        tenantId: a,
        actorUserId: inspector,
        typeKey: "extinguisher",
        code: `PX${stamp % 100000}`,
        description: "Pasillo",
        siteId: siteA,
        attributes: { agent: "abc", capacityKg: 5, manufacturedAt: "2022-05-10" },
        dueDates: [{ kind: "maintenance", lastDoneAt: "2026-03-31" }],
      });
      await expect(startInspection({ tenantId: a, actorUserId: inspector, assetId: ext.id, templateKey: "light_pre_use" })).rejects.toThrow(/no admite/);
    });

    it("cerrar apto: copia el odómetro, no crea programa ni vencimientos y se muestra «hoy»", async () => {
      const v = await newVehicle();
      const { id } = await startPreUse(v.id);
      await fill(id, [], 51_000);
      const first = await close(id);
      const again = await close(id);
      expect(first.alreadyClosed).toBe(false);
      expect(again.alreadyClosed).toBe(true);
      const closed = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(closed).toMatchObject({ status: "closed", result: "fit", readingKm: 51_000, actionId: null, findingId: null, applicableCount: 9 });
      expect(await db.inspectionPlan.count({ where: { tenantId: a, assetId: v.id, template: { key: "light_pre_use" } } })).toBe(0);
      expect(await openDues(v.id)).toBe(0);
      expect((await db.asset.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("in_service");
      const last = await lastPreUseControl(a, v.id, "light_pre_use");
      expect(last).toMatchObject({ id, inspectedAt: todayIso(), daysAgo: 0, result: "fit" });
    });

    it("no puede cerrarse sin el odómetro", async () => {
      const v = await newVehicle();
      const { id } = await startPreUse(v.id);
      const view = (await getInspectionView(a, id))!;
      for (const row of view.items.filter((i) => i.item.kind === "check")) {
        await saveAnswer({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: row.item.id, patch: { value: "conform" } });
      }
      await expect(close(id)).rejects.toBeInstanceOf(InspectionError);
    });

    it("un odómetro menor que el anterior exige confirmación", async () => {
      const v = await newVehicle();
      const first = await startPreUse(v.id);
      await fill(first.id, [], 60_000);
      await close(first.id);
      const second = await startPreUse(v.id);
      await fill(second.id, [], 59_000);
      await expect(close(second.id)).rejects.toThrow(/menor que la anterior/);
      const ok = await close(second.id, { confirmLowerReadings: true });
      expect(ok.alreadyClosed).toBe(false);
    });

    it("con una crítica: vehículo fuera de servicio, una acción, sin hallazgo ni programa, y no queda pendiente de nada", async () => {
      const v = await newVehicle();
      const { id } = await startPreUse(v.id);
      await fill(id, ["safety_brakes"]);
      await close(id);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection).toMatchObject({ result: "unfit", findingId: null });
      expect(inspection.actionId).toBeTruthy();
      expect(await db.action.count({ where: { tenantId: a, id: inspection.actionId! } })).toBe(1);
      expect(await db.finding.count({ where: { tenantId: a, origin: "inspection", title: { contains: v.code } } })).toBe(0);
      const asset = await db.asset.findUniqueOrThrow({ where: { id: v.id } });
      expect(asset.status).toBe("out_of_service");
      expect(await db.assetStatusEvent.count({ where: { assetId: v.id, inspectionId: id } })).toBe(1);
      expect(await db.inspectionPlan.count({ where: { tenantId: a, assetId: v.id, template: { key: "light_pre_use" } } })).toBe(0);
      expect(await openDues(v.id)).toBe(0);
    });

    it("un control previo apto nunca libera un vehículo que dejó parado SST, aunque lo cierre quien puede liberar", async () => {
      const v = await newVehicle();
      const bad = await startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id });
      await fill(bad.id, ["safety_brakes_steering"]);
      await close(bad.id);
      expect((await db.asset.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("out_of_service");

      const pre = await startPreUse(v.id);
      await fill(pre.id);
      await close(pre.id, { canRelease: true });
      expect((await db.asset.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("out_of_service");
    });
  });

  describe("inspección mensual", () => {
    it("trae seguro, RTO y service automáticos y se programa al mes con aviso a 7 días", async () => {
      const v = await newVehicle();
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id });
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id }, include: { template: true, answers: { include: { item: true } } } });
      expect(inspection.template.key).toBe("light_periodic");
      // Sin antivuelco ni monitoreo: 14 controles + odómetro.
      expect(inspection.answers).toHaveLength(15);
      expect(inspection.answers.filter((r) => r.autoDerived).map((r) => [r.item.code, r.value])).toEqual(
        expect.arrayContaining([
          ["docs_insurance", "conform"],
          ["docs_rto", "conform"],
          ["docs_service", "conform"],
        ]),
      );
      await fill(id);
      await close(id);
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, assetId: v.id } });
      expect(plan).toMatchObject({ lastResult: "fit", active: true });
      expect(isoFromDate(plan.nextDueAt!)).toBe(addMonths(todayIso(), 1));
      const dues = await db.dueItem.findMany({ where: { tenantId: a, entityType: "inspection_plan", entityId: plan.id, status: "open" } });
      expect(dues).toHaveLength(1);
      expect(dues[0].leadDays).toBe(7);
    });

    it("el antivuelco y el monitoreo aparecen solo cuando el vehículo los tiene", async () => {
      const v = await newVehicle({
        attributes: { hasRollbar: true, hasSatelliteMonitoring: true },
        dueDates: [
          { kind: "insurance", dueAt: future(100) },
          { kind: "rto", dueAt: future(100) },
          { kind: "service", dueAt: future(100) },
          { kind: "satellite_monitoring", dueAt: future(100) },
        ],
      });
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id });
      expect(await db.inspectionAnswer.count({ where: { inspectionId: id } })).toBe(17);
    });

    it("con el seguro vencido nace no conforme: la inspección queda no apta, con hallazgo borrador y reinspección a 7 días", async () => {
      const v = await newVehicle({
        dueDates: [
          { kind: "insurance", dueAt: addDays(todayIso(), -3) },
          { kind: "rto", dueAt: future(100) },
          { kind: "service", dueAt: future(100) },
        ],
      });
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id });
      await fill(id);
      await close(id);
      const inspection = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(inspection).toMatchObject({ result: "unfit" });
      expect(inspection.actionId).toBeTruthy();
      expect(inspection.findingId).toBeTruthy();
      const finding = await db.finding.findUniqueOrThrow({ where: { id: inspection.findingId! } });
      expect(finding).toMatchObject({ tenantId: a, origin: "inspection" });
      const plan = await db.inspectionPlan.findFirstOrThrow({ where: { tenantId: a, assetId: v.id } });
      expect(isoFromDate(plan.nextDueAt!)).toBe(addDays(todayIso(), 7));
      expect((await db.asset.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("out_of_service");
    });

    it("una NC crítica deja un hallazgo; la reinspección apta la libera solo si quien cierra puede liberar", async () => {
      const v = await newVehicle();
      const bad = await startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id });
      await fill(bad.id, ["safety_tires"]);
      await close(bad.id);
      const closed = await db.inspection.findUniqueOrThrow({ where: { id: bad.id } });
      expect(closed.findingId).toBeTruthy();
      expect((await db.asset.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("out_of_service");

      const noRelease = await startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id });
      await fill(noRelease.id);
      await close(noRelease.id, { canRelease: false });
      expect((await db.asset.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("out_of_service");

      const release = await startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id });
      await fill(release.id);
      await close(release.id, { canRelease: true });
      expect((await db.asset.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("in_service");
    });

    it("los neumáticos por debajo del mínimo son una no conformidad mayor: apta con observaciones y una acción", async () => {
      const v = await newVehicle();
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: v.id });
      await fill(id);
      const view = (await getInspectionView(a, id))!;
      const tread = view.items.find((i) => i.item.code === "safety_tread")!;
      await saveAnswer({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: tread.item.id, patch: { numberValue: 1.2, comment: "Gastado" } });
      await addInspectionPhoto({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: tread.item.id, fileName: "f.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage });
      await close(id);
      const closed = await db.inspection.findUniqueOrThrow({ where: { id } });
      expect(closed).toMatchObject({ result: "fit_with_observations", nonconformCount: 1, findingId: null });
      expect(closed.actionId).toBeTruthy();
    });
  });

  describe("aislamiento y baja", () => {
    it("otra empresa no puede inspeccionar ni leer el vehículo, ni su último control previo", async () => {
      const v = await newVehicle();
      await expect(startInspection({ tenantId: b, actorUserId: inspector, assetId: v.id, templateKey: "light_pre_use" })).rejects.toThrow(/Activo no encontrado/);
      const mine = await startPreUse(v.id);
      await fill(mine.id);
      await close(mine.id);
      expect(await lastPreUseControl(b, v.id, "light_pre_use")).toBeNull();
      expect(await lastPreUseControl(a, v.id, "light_pre_use")).not.toBeNull();
      // Un vehículo de B queda en B.
      const other = await newVehicle({ tenant: b, site: siteB });
      expect((await db.asset.findUniqueOrThrow({ where: { id: other.id } })).tenantId).toBe(b);
      await expect(startPreUse(other.id)).rejects.toThrow(/Activo no encontrado/);
    });

    it("no se puede hacer un control previo sobre un vehículo dado de baja", async () => {
      const v = await newVehicle();
      await db.asset.update({ where: { id: v.id }, data: { status: "retired", retiredAt: new Date() } });
      await expect(startPreUse(v.id)).rejects.toThrow(/dado de baja/);
    });
  });
});
