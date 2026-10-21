import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { createAsset, retireAsset } from "@/lib/assets";
import {
  addInspectionPhoto,
  closeInspection,
  deleteInspectionPhoto,
  findNextPendingAsset,
  getInspectionView,
  listInspections,
  readInspectionAttachment,
  saveAnswer,
  saveInspectionMeta,
  startInspection,
} from "@/lib/inspections";
import { InspectionError } from "@/lib/inspection-support";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { addDays, todayIso } from "@/domain/inspections/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("registro de inspecciones (integración)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let inspector = "";
  let other = "";
  let siteA = "";
  let siteB = "";
  let seq = 0;

  const attrs = { agent: "abc", capacityKg: 5, manufacturedAt: "2022-05-10" };
  const newAsset = (over: Record<string, unknown> = {}) =>
    createAsset({
      tenantId: a,
      actorUserId: inspector,
      typeKey: "extinguisher",
      code: `T${stamp % 100000}-${++seq}`,
      description: "Pasillo",
      siteId: siteA,
      attributes: attrs,
      dueDates: [{ kind: "maintenance", lastDoneAt: "2026-03-31" }],
      ...over,
    });

  /** Responde todo lo que no es automático con «conforme». */
  async function answerAll(inspectionId: string, who = inspector, except: Record<string, "nonconform"> = {}) {
    const view = (await getInspectionView(a, inspectionId))!;
    for (const row of view.items.filter((i) => !i.answer.autoDerived)) {
      await saveAnswer({ tenantId: a, actorUserId: who, canEditOthers: false, inspectionId, itemId: row.item.id, patch: { value: except[row.item.code] ?? "conform" } });
    }
    return view;
  }
  const close = (inspectionId: string, who = inspector) => closeInspection({ tenantId: a, actorUserId: who, canEditOthers: false, inspectionId });
  const itemId = async (inspectionId: string, code: string) => (await getInspectionView(a, inspectionId))!.items.find((i) => i.item.code === code)!.item.id;

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `InspR ${label}`, slug: `inspr-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    inspector = (await db.user.create({ data: { name: "Inés Inspectora", email: `inspr-${stamp}@test.dev`, emailVerified: true } })).id;
    other = (await db.user.create({ data: { name: "Otro Usuario", email: `inspr-o-${stamp}@test.dev`, emailVerified: true } })).id;
    siteA = (await createSite({ tenantId: a, actorUserId: inspector, name: "Base" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: inspector, name: "Base" })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [inspector, other] } } });
    await db.$disconnect();
  });

  it("empezar crea el borrador con la versión de la plantilla y una respuesta por ítem aplicable", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    const view = (await getInspectionView(a, id))!;
    expect(view.inspection).toMatchObject({ status: "draft", siteId: siteA, assetId: asset.id, result: null });
    expect(view.inspection.templateVersion.version).toBe(1);
    const codes = view.items.map((i) => i.item.code);
    expect(codes).toHaveLength(13);
    expect(codes).toContain("state_gauge");
    expect(codes).not.toContain("state_weight");
    expect(codes).not.toContain("state_wheels");
    // Los automáticos vienen resueltos con los vencimientos del activo.
    const maintenance = view.items.find((i) => i.item.code === "docs_maintenance")!;
    expect(maintenance.answer).toMatchObject({ autoDerived: true, value: "conform" });
    expect(maintenance.autoDueAt).toBe("2027-03-31");
  });

  it("los ítems dependen del activo: CO₂ sobre ruedas pide peso y ruedas, no manómetro", async () => {
    const co2 = await newAsset({ attributes: { agent: "co2", capacityKg: 5, manufacturedAt: "2022-05-10", onWheels: true } });
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: co2.id });
    const codes = (await getInspectionView(a, id))!.items.map((i) => i.item.code);
    expect(codes).toContain("state_weight");
    expect(codes).toContain("state_wheels");
    expect(codes).not.toContain("state_gauge");
  });

  it("empezar dos veces (o a la vez) devuelve el mismo borrador", async () => {
    const asset = await newAsset();
    const [x, y, z] = await Promise.all([1, 2, 3].map(() => startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id })));
    expect(new Set([x.id, y.id, z.id]).size).toBe(1);
    expect(await db.inspection.count({ where: { assetId: asset.id } })).toBe(1);
    // Otro inspector sí puede tener su propio borrador.
    const mine = await startInspection({ tenantId: a, actorUserId: other, assetId: asset.id });
    expect(mine.id).not.toBe(x.id);
  });

  it("no se inspecciona un activo dado de baja ni uno de otra empresa", async () => {
    const asset = await newAsset();
    await retireAsset({ tenantId: a, actorUserId: inspector, assetId: asset.id, reason: "Fuera de uso" });
    await expect(startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id })).rejects.toThrow("dado de baja");
    const live = await newAsset();
    await expect(startInspection({ tenantId: b, actorUserId: inspector, assetId: live.id })).rejects.toThrow("no encontrado");
  });

  it("guarda respuestas sueltas y rechaza lo que no corresponde", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    const gauge = await itemId(id, "state_gauge");
    await saveAnswer({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: gauge, patch: { value: "nonconform" } });
    await saveAnswer({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: gauge, patch: { comment: " aguja en rojo " } });
    const saved = await db.inspectionAnswer.findUniqueOrThrow({ where: { inspectionId_itemId: { inspectionId: id, itemId: gauge } } });
    expect(saved).toMatchObject({ value: "nonconform", comment: "aguja en rojo" });
    expect(saved.answeredAt).not.toBeNull();

    const auto = await itemId(id, "docs_hydrostatic");
    await expect(saveAnswer({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: auto, patch: { value: "na" } })).rejects.toThrow("sistema");
    await expect(saveAnswer({ tenantId: a, actorUserId: other, canEditOthers: false, inspectionId: id, itemId: gauge, patch: { value: "conform" } })).rejects.toThrow("Solo quien empezó");
    await saveAnswer({ tenantId: a, actorUserId: other, canEditOthers: true, inspectionId: id, itemId: gauge, patch: { value: "conform" } });
    await expect(saveAnswer({ tenantId: b, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: gauge, patch: { value: "conform" } })).rejects.toThrow("no encontrada");
  });

  it("cerrar con todo conforme: apto, 100 %, firmado, y no se puede editar después", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    await answerAll(id);
    const outcome = await close(id);
    expect(outcome).toEqual({ id, alreadyClosed: false });
    const closed = await db.inspection.findUniqueOrThrow({ where: { id } });
    expect(closed).toMatchObject({ status: "closed", result: "fit", scorePct: 100, applicableCount: 13, conformCount: 13, nonconformCount: 0, inspectorUserId: inspector });
    expect(closed.closedAt).not.toBeNull();
    const gauge = await itemId(id, "state_gauge");
    await expect(saveAnswer({ tenantId: a, actorUserId: inspector, canEditOthers: true, inspectionId: id, itemId: gauge, patch: { value: "nonconform" } })).rejects.toThrow("cerrada");
    await expect(saveInspectionMeta({ tenantId: a, actorUserId: inspector, canEditOthers: true, inspectionId: id, notes: "tarde" })).rejects.toThrow("cerrada");
  });

  it("no cierra si falta responder, y avisa cuántos ítems faltan", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    const error = await close(id).catch((e) => e);
    expect(error).toBeInstanceOf(InspectionError);
    expect(error.code).toBe("incomplete");
    expect(error.message).toContain("11"); // 13 ítems, 2 los completa el sistema
  });

  it("una no conformidad crítica exige foto y comentario; con ambos cierra como no apto", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    await answerAll(id, inspector, { state_seal: "nonconform" });
    const blocked = await close(id).catch((e) => e);
    expect(blocked.code).toBe("blocked");
    expect(blocked.details.blockers.map((x: { code: string }) => x.code)).toEqual(["photo_required", "comment_required"]);

    const seal = await itemId(id, "state_seal");
    await saveAnswer({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: seal, patch: { comment: "Precinto roto" } });
    await addInspectionPhoto({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: seal, fileName: "precinto.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage });
    await close(id);
    expect(await db.inspection.findUniqueOrThrow({ where: { id } })).toMatchObject({ result: "unfit", scorePct: 92.3, nonconformCount: 1 });
  });

  it("una no conformidad menor no pide foto: apto con observaciones", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    await answerAll(id, inspector, { loc_mount: "nonconform" });
    await saveAnswer({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: await itemId(id, "loc_mount"), patch: { comment: "Soporte flojo" } });
    await close(id);
    expect((await db.inspection.findUniqueOrThrow({ where: { id } })).result).toBe("fit_with_observations");
  });

  it("la prueba hidráulica vencida pisa lo que marque el inspector: no apto sin foto", async () => {
    const asset = await newAsset({ dueDates: [{ kind: "maintenance", lastDoneAt: "2026-03-31" }, { kind: "hydrostatic_test", lastDoneAt: "2020-01-01", dueAt: "2024-01-01" }] });
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    const view = await answerAll(id);
    expect(view.items.find((i) => i.item.code === "docs_hydrostatic")!.answer.value).toBe("nonconform");
    await close(id);
    expect(await db.inspection.findUniqueOrThrow({ where: { id } })).toMatchObject({ result: "unfit" });
  });

  it("cerrar dos veces (o dos pedidos a la vez) deja un solo cierre", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    await answerAll(id);
    const outcomes = await Promise.all([close(id), close(id), close(id)]);
    expect(outcomes.filter((o) => !o.alreadyClosed)).toHaveLength(1);
    expect(await db.inspectionAudit.count({ where: { tenantId: a, entityId: id, action: "close" } })).toBe(1);
    expect((await close(id)).alreadyClosed).toBe(true);
  });

  it("solo quien empezó puede cerrar, salvo permiso de responsable", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    await answerAll(id);
    await expect(close(id, other)).rejects.toThrow("Solo quien empezó");
    await expect(closeInspection({ tenantId: b, actorUserId: inspector, canEditOthers: true, inspectionId: id })).rejects.toThrow("no encontrada");
    await expect(closeInspection({ tenantId: a, actorUserId: other, canEditOthers: true, inspectionId: id })).resolves.toMatchObject({ alreadyClosed: false });
  });

  it("la fecha no puede ser futura ni tener más de 7 días", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    await answerAll(id);
    await saveInspectionMeta({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, inspectedAt: addDays(todayIso(), 1) });
    expect(((await close(id).catch((e) => e)) as InspectionError).details).toMatchObject({ blockers: [{ code: "date_in_future" }] });
    await saveInspectionMeta({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, inspectedAt: addDays(todayIso(), -8) });
    expect(((await close(id).catch((e) => e)) as InspectionError).details).toMatchObject({ blockers: [{ code: "date_too_old" }] });
    await saveInspectionMeta({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, inspectedAt: addDays(todayIso(), -7) });
    await expect(close(id)).resolves.toMatchObject({ alreadyClosed: false });
  });

  it("editar la plantilla no cambia lo ya empezado: el borrador conserva la versión 1", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    const template = await db.inspectionTemplate.findUniqueOrThrow({ where: { tenantId_key: { tenantId: a, key: "extinguisher_periodic" } } });
    const v2 = await db.inspectionTemplateVersion.create({ data: { tenantId: a, templateId: template.id, version: 2, note: "Versión de prueba" } });
    await db.inspectionTemplateItem.create({ data: { tenantId: a, versionId: v2.id, code: "solo_v2", section: "X", sortOrder: 0, text: "Único ítem", criticality: "critical", photoOnNc: true } });
    await db.inspectionTemplate.update({ where: { id: template.id }, data: { activeVersionId: v2.id } });
    try {
      expect((await getInspectionView(a, id))!.items).toHaveLength(13);
      const another = await newAsset();
      const fresh = await startInspection({ tenantId: a, actorUserId: inspector, assetId: another.id });
      const view = (await getInspectionView(a, fresh.id))!;
      expect(view.inspection.templateVersion.version).toBe(2);
      expect(view.items.map((i) => i.item.code)).toEqual(["solo_v2"]);
    } finally {
      const v1 = await db.inspectionTemplateVersion.findFirstOrThrow({ where: { templateId: template.id, version: 1 } });
      await db.inspectionTemplate.update({ where: { id: template.id }, data: { activeVersionId: v1.id } });
    }
  });

  describe("fotos", () => {
    it("guarda, lista, descarga y borra fotos; respeta tipos y límites", async () => {
      const asset = await newAsset();
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
      const seal = await itemId(id, "state_seal");
      const add = (name = "a.jpg", type = "image/jpeg", body = Buffer.from("x")) =>
        addInspectionPhoto({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, itemId: seal, fileName: name, contentType: type, body, storage });

      const photo = await add("foto precinto.jpg", "image/jpeg", Buffer.from("contenido"));
      const read = await readInspectionAttachment(photo.id, { storage });
      expect(read?.body.toString()).toBe("contenido");
      expect(read?.attachment).toMatchObject({ tenantId: a, inspectionId: id, kind: "photo" });
      expect(read?.attachment.storageKey).toBe(`tenants/${a}/inspections/${id}/${photo.id}/foto_precinto.jpg`);

      await expect(add("a.pdf", "application/pdf")).rejects.toThrow("JPG");
      await expect(add("vacia.jpg", "image/jpeg", Buffer.alloc(0))).rejects.toThrow("vacía");
      for (let i = 0; i < 4; i++) await add(`f${i}.jpg`);
      await expect(add("sexta.jpg")).rejects.toThrow("hasta 5");

      await deleteInspectionPhoto({ tenantId: a, actorUserId: inspector, canEditOthers: false, inspectionId: id, attachmentId: photo.id, storage });
      expect(await readInspectionAttachment(photo.id, { storage })).toBeNull();
      await expect(deleteInspectionPhoto({ tenantId: b, actorUserId: inspector, canEditOthers: true, inspectionId: id, attachmentId: photo.id, storage })).rejects.toThrow();
    });

    it("no se agregan fotos a una inspección cerrada", async () => {
      const asset = await newAsset();
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
      await answerAll(id);
      await close(id);
      await expect(
        addInspectionPhoto({ tenantId: a, actorUserId: inspector, canEditOthers: true, inspectionId: id, itemId: await itemId(id, "state_seal"), fileName: "x.jpg", contentType: "image/jpeg", body: Buffer.from("x"), storage }),
      ).rejects.toThrow("cerrada");
    });
  });

  describe("listado y ronda", () => {
    it("pagina por cursor, aísla por empresa y hace las mismas consultas con 25 filas que con 5", async () => {
      for (let i = 0; i < 6; i++) {
        const asset = await newAsset();
        await startInspection({ tenantId: a, actorUserId: other, assetId: asset.id });
      }
      const first = await listInspections(a, { take: 5 });
      expect(first.items).toHaveLength(5);
      expect(first.nextCursor).not.toBeNull();
      const second = await listInspections(a, { take: 5, after: first.nextCursor! });
      expect(second.items.some((r) => first.items.some((f) => f.id === r.id))).toBe(false);
      expect((await listInspections(b)).items).toHaveLength(0);
      expect((await listInspections(a, { status: "draft", inspectorUserId: other })).items.every((r) => r.status === "draft")).toBe(true);

      const counting = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
      let queries = 0;
      counting.$on("query", () => queries++);
      try {
        await listInspections(a, { take: 5 }, counting);
        const few = queries;
        queries = 0;
        const page = await listInspections(a, { take: 25 }, counting);
        expect(page.items.length).toBeGreaterThan(5);
        expect(queries).toBe(few);
      } finally {
        await counting.$disconnect();
      }
    });

    it("«siguiente activo pendiente» propone otro activo de la misma sede que hoy no inspeccionó", async () => {
      const site = await createSite({ tenantId: a, actorUserId: inspector, name: "Obrador ronda" });
      const make = (code: string) => newAsset({ code, siteId: site.id });
      const [x, y, z] = [await make("RONDA-1"), await make("RONDA-2"), await make("RONDA-3")];
      const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: x.id });
      await answerAll(id);
      await close(id);
      const next = await findNextPendingAsset({ tenantId: a, siteId: site.id, excludeAssetId: x.id, actorUserId: inspector });
      expect([y.id, z.id]).toContain(next?.id);
      const draft = await startInspection({ tenantId: a, actorUserId: inspector, assetId: next!.id });
      await answerAll(draft.id);
      await close(draft.id);
      const last = await findNextPendingAsset({ tenantId: a, siteId: site.id, excludeAssetId: next!.id, actorUserId: inspector });
      expect(last?.id).toBe([y.id, z.id].find((i) => i !== next!.id));
      expect(await findNextPendingAsset({ tenantId: b, siteId: siteB, excludeAssetId: null, actorUserId: inspector })).toBeNull();
    });
  });

  it("aislamiento: la empresa B no ve la inspección ni los adjuntos de A", async () => {
    const asset = await newAsset();
    const { id } = await startInspection({ tenantId: a, actorUserId: inspector, assetId: asset.id });
    expect(await getInspectionView(b, id)).toBeNull();
    expect(await getInspectionView(a, id)).not.toBeNull();
  });
});
