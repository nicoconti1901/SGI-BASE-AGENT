import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createJobPosition, createPerson, createSite } from "@/lib/masterdata";
import { ensureDefaultTemplates } from "@/lib/inspection-templates";
import { DEFAULT_TEMPLATES } from "@/domain/inspections/templates";
import {
  applyAssetImport,
  createAsset,
  getAsset,
  listAssets,
  previewAssetImport,
  renewAssetDueDate,
  retireAsset,
  searchAssets,
  updateAsset,
} from "@/lib/assets";
import { InspectionError } from "@/lib/inspection-support";
import { addMonths, todayIso } from "@/domain/inspections/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("activos de inspecciones (integración)", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let actor = "";
  let siteA = "";
  let siteA2 = "";
  let siteB = "";
  let personA = "";
  let personAUser = "";

  const attrs = { agent: "abc", capacityKg: 5, manufacturedAt: "2022-05-10" };
  const base = () => ({ tenantId: a, actorUserId: actor, typeKey: "extinguisher", description: "Pasillo", siteId: siteA, attributes: attrs, dueDates: [{ kind: "maintenance", lastDoneAt: "2026-03-31" }] });

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `Insp ${label}`, slug: `insp-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    const user = await db.user.create({ data: { name: "Insp Admin", email: `insp-${stamp}@test.dev`, emailVerified: true } });
    const member = await db.user.create({ data: { name: "Insp Operario", email: `insp-op-${stamp}@test.dev`, emailVerified: true } });
    await db.membership.create({ data: { tenantId: a, userId: member.id, role: "contributor" } });
    actor = user.id;
    personAUser = member.id;
    siteA = (await createSite({ tenantId: a, actorUserId: actor, name: "Base Neuquén" })).id;
    siteA2 = (await createSite({ tenantId: a, actorUserId: actor, name: "Obrador 1" })).id;
    siteB = (await createSite({ tenantId: b, actorUserId: actor, name: "Base Neuquén" })).id;
    const position = await createJobPosition({ tenantId: a, actorUserId: actor, name: "Operario" });
    personA = (await createPerson({ tenantId: a, actorUserId: actor, employeeCode: "P1", name: "Pedro", siteId: siteA, positionId: position.id, userId: personAUser })).id;
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [actor, personAUser] } } });
    await db.$disconnect();
  });

  it("ensureDefaultTemplates es idempotente, también con llamadas simultáneas", async () => {
    await Promise.all([ensureDefaultTemplates(a), ensureDefaultTemplates(a), ensureDefaultTemplates(a)]);
    await ensureDefaultTemplates(a);
    const templates = await db.inspectionTemplate.findMany({ where: { tenantId: a }, include: { versions: { include: { items: true } } } });
    // Una por plantilla precargada, cada una con una sola versión.
    expect(templates.map((t) => t.key).sort()).toEqual(DEFAULT_TEMPLATES.map((t) => t.key).sort());
    for (const t of templates) expect(t.versions).toHaveLength(1);
    const extinguisher = templates.find((t) => t.key === "extinguisher_periodic")!;
    expect(extinguisher.versions[0].items).toHaveLength(15);
    expect(extinguisher.activeVersionId).toBe(extinguisher.versions[0].id);
    expect(extinguisher).toMatchObject({ intervalUnit: "months", intervalValue: 1, canReinstate: true, retireOnUnfit: false, findingOnCritical: false });
  });

  it("el alta crea el activo, sus vencimientos, su programa y los avisos abiertos", async () => {
    const asset = await createAsset({ ...base(), code: "ext-001", assignedPersonId: personA });
    expect(asset.code).toBe("EXT-001");
    const full = await getAsset(a, asset.id);
    expect(full?.dueDates.map((d) => d.kind).sort()).toEqual(["hydrostatic_test", "maintenance"]);
    expect(full?.dueDates.find((d) => d.kind === "maintenance")?.dueAt.toISOString().slice(0, 10)).toBe("2027-03-31");
    expect(full?.plans).toHaveLength(1);
    expect(full?.plans[0].nextDueAt?.toISOString().slice(0, 10)).toBe(addMonths(todayIso(), 1));
    expect(full?.statusEvents[0]).toMatchObject({ toStatus: "in_service", reasonCode: "created" });

    const ids = [...full!.dueDates.map((d) => d.id), full!.plans[0].id];
    const items = await db.dueItem.findMany({ where: { tenantId: a, entityId: { in: ids }, status: "open" } });
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.siteId === siteA && i.personId === personA && i.ownerUserId === personAUser)).toBe(true);
    const plan = items.find((i) => i.entityType === "inspection_plan")!;
    expect(plan.leadDays).toBe(7);
    expect(plan.remindAt.getTime()).toBe(plan.dueAt.getTime() - 7 * 86_400_000);
    expect(await db.inspectionAudit.count({ where: { tenantId: a, entityId: asset.id, action: "create" } })).toBe(1);
  });

  it("rechaza código repetido en la empresa, pero otra empresa puede repetirlo", async () => {
    await expect(createAsset({ ...base(), code: "EXT-001" })).rejects.toThrow("Ya existe un activo con ese código");
    const other = await createAsset({ ...base(), tenantId: b, siteId: siteB, code: "EXT-001" });
    expect(other.tenantId).toBe(b);
  });

  it("valida atributos, vencimientos, sede y persona", async () => {
    await expect(createAsset({ ...base(), code: "X1", attributes: { agent: "abc", capacityKg: 5 } })).rejects.toBeInstanceOf(InspectionError);
    await expect(createAsset({ ...base(), code: "X2", dueDates: [] })).rejects.toThrow("Mantenimiento");
    await expect(createAsset({ ...base(), code: "X3", siteId: siteB })).rejects.toThrow("sede");
    await expect(createAsset({ ...base(), code: "X4", assignedPersonId: "no-existe" })).rejects.toThrow("persona");
    await expect(createAsset({ ...base(), code: "X5", ownership: "contractor" })).rejects.toThrow("contratista");
    await expect(createAsset({ ...base(), code: "X6", typeKey: "crane" })).rejects.toThrow("Tipo");
  });

  it("aislamiento: la empresa A no lee, edita, renueva ni da de baja los activos de B", async () => {
    const [assetB] = await db.asset.findMany({ where: { tenantId: b } });
    expect(await getAsset(a, assetB.id)).toBeNull();
    expect((await listAssets(a)).items.every((x) => x.tenantId === a)).toBe(true);
    expect(await searchAssets(a, { q: assetB.code })).toHaveLength(1); // el EXT-001 de A, no el de B
    expect((await searchAssets(a, { q: assetB.code }))[0].id).not.toBe(assetB.id);
    const edit = { tenantId: a, actorUserId: actor, assetId: assetB.id, description: "hack", siteId: siteA, attributes: attrs };
    await expect(updateAsset(edit)).rejects.toThrow("no encontrado");
    await expect(renewAssetDueDate({ tenantId: a, actorUserId: actor, assetId: assetB.id, kind: "maintenance", dueAt: "2030-01-01" })).rejects.toThrow("no encontrado");
    await expect(retireAsset({ tenantId: a, actorUserId: actor, assetId: assetB.id, reason: "intento ajeno" })).rejects.toThrow("no encontrado");
    expect((await db.asset.findUniqueOrThrow({ where: { id: assetB.id } })).status).toBe("in_service");
  });

  it("al cambiar de sede o de persona, los avisos pasan a la nueva sede", async () => {
    const asset = await createAsset({ ...base(), code: "MOVE-1" });
    await updateAsset({ tenantId: a, actorUserId: actor, assetId: asset.id, description: "Movido", siteId: siteA2, assignedPersonId: personA, attributes: attrs });
    const full = await getAsset(a, asset.id);
    const ids = [...full!.dueDates.map((d) => d.id), full!.plans[0].id];
    const open = await db.dueItem.findMany({ where: { tenantId: a, entityId: { in: ids }, status: "open" } });
    expect(open).toHaveLength(3);
    expect(open.every((i) => i.siteId === siteA2 && i.ownerUserId === personAUser)).toBe(true);
    expect(full?.plans[0].siteId).toBe(siteA2);
  });

  it("renovar reemplaza el aviso abierto sin duplicarlo, aun con dos renovaciones a la vez", async () => {
    const asset = await createAsset({ ...base(), code: "REN-1" });
    const due = (await getAsset(a, asset.id))!.dueDates.find((d) => d.kind === "maintenance")!;
    await Promise.all([
      renewAssetDueDate({ tenantId: a, actorUserId: actor, assetId: asset.id, kind: "maintenance", lastDoneAt: "2026-10-01", reference: "CERT-1" }),
      renewAssetDueDate({ tenantId: a, actorUserId: actor, assetId: asset.id, kind: "maintenance", lastDoneAt: "2026-10-02", reference: "CERT-2" }),
    ]);
    const open = await db.dueItem.findMany({ where: { tenantId: a, entityId: due.id, status: "open" } });
    expect(open).toHaveLength(1);
    const renewed = await db.assetDueDate.findUniqueOrThrow({ where: { id: due.id } });
    expect(renewed.dueAt.toISOString().slice(0, 10)).toBe("2027-10-0" + (renewed.reference === "CERT-1" ? "1" : "2"));
    await expect(renewAssetDueDate({ tenantId: a, actorUserId: actor, assetId: asset.id, kind: "service", dueAt: "2030-01-01" })).rejects.toThrow("no corresponde");
  });

  it("la baja conserva el historial, cierra los avisos y bloquea ediciones", async () => {
    const asset = await createAsset({ ...base(), code: "BAJA-1" });
    await expect(retireAsset({ tenantId: a, actorUserId: actor, assetId: asset.id, reason: "x" })).rejects.toThrow("motivo");
    await retireAsset({ tenantId: a, actorUserId: actor, assetId: asset.id, reason: "Vendido a terceros" });
    await retireAsset({ tenantId: a, actorUserId: actor, assetId: asset.id, reason: "Otra vez" }).catch((e) => expect(e.message).toContain("ya está"));
    const full = await getAsset(a, asset.id);
    expect(full).toMatchObject({ status: "retired", retirementReason: "Vendido a terceros" });
    expect(full?.statusEvents[0]).toMatchObject({ toStatus: "retired", note: "Vendido a terceros" });
    expect(full?.plans[0]).toMatchObject({ active: false, nextDueAt: null });
    const ids = [...full!.dueDates.map((d) => d.id), full!.plans[0].id];
    expect(await db.dueItem.count({ where: { tenantId: a, entityId: { in: ids }, status: "open" } })).toBe(0);
    await expect(updateAsset({ tenantId: a, actorUserId: actor, assetId: asset.id, description: "x2", siteId: siteA, attributes: attrs })).rejects.toThrow("baja");
    expect(await searchAssets(a, { q: "BAJA-1" })).toHaveLength(0);
  });

  describe("importación por CSV", () => {
    const header = "codigo,descripcion,sede,agente,capacidad_kg,fabricacion,ultimo_mantenimiento";
    const rows = (n: number, prefix = "IMP") =>
      Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(3, "0")},Extintor ${i + 1},Base Neuquén,ABC,5,2022-05-10,2026-03-31`);

    it("20 extintores con 2 errores: importa 18, informa los errores y reimportar no duplica", async () => {
      const lines = rows(20);
      lines[3] = "IMP-004,Sin sede válida,Sede Fantasma,ABC,5,2022-05-10,2026-03-31";
      lines[7] = "IMP-008,Agente raro,Base Neuquén,XYZ,5,2022-05-10,2026-03-31";
      const csv = [header, ...lines].join("\n");

      const preview = await previewAssetImport(a, "extinguisher", csv);
      expect(preview.counts).toMatchObject({ create: 18, update: 0, unchanged: 0, error: 1 });
      expect(preview.errors).toHaveLength(1);
      expect(preview.items.find((i) => i.code === "IMP-004")?.reason).toContain("Sede Fantasma");
      expect(await db.asset.count({ where: { tenantId: a, code: { startsWith: "IMP-" } } })).toBe(0); // la vista previa no guarda nada

      const done = await applyAssetImport({ tenantId: a, actorUserId: actor, typeKey: "extinguisher", csv });
      expect(done.counts.create).toBe(18);
      expect(await db.asset.count({ where: { tenantId: a, code: { startsWith: "IMP-" } } })).toBe(18);
      const imported = await db.asset.findFirstOrThrow({ where: { tenantId: a, code: "IMP-001" }, include: { dueDates: true, plans: true } });
      expect(imported.dueDates).toHaveLength(2);
      expect(imported.plans).toHaveLength(1);
      const openAfterFirst = await db.dueItem.count({ where: { tenantId: a, status: "open", entityType: { in: ["asset_due_date", "inspection_plan"] }, title: { contains: "IMP-" } } });
      expect(openAfterFirst).toBe(18 * 3);

      const again = await applyAssetImport({ tenantId: a, actorUserId: actor, typeKey: "extinguisher", csv });
      expect(again.counts).toMatchObject({ create: 0, update: 0, unchanged: 18 });
      expect(await db.asset.count({ where: { tenantId: a, code: { startsWith: "IMP-" } } })).toBe(18);
      expect(await db.dueItem.count({ where: { tenantId: a, status: "open", title: { contains: "IMP-" } } })).toBe(18 * 3);
    });

    it("reimportar con un cambio actualiza por código y reprograma el aviso", async () => {
      const csv = [header, "IMP-001,Descripción nueva,Obrador 1,ABC,5,2022-05-10,2026-06-30"].join("\n");
      const preview = await previewAssetImport(a, "extinguisher", csv);
      expect(preview.items[0]).toMatchObject({ action: "update" });
      expect(preview.items[0].changes).toEqual(expect.arrayContaining(["descripción", "sede", "mantenimiento"]));
      await applyAssetImport({ tenantId: a, actorUserId: actor, typeKey: "extinguisher", csv });
      const asset = await db.asset.findFirstOrThrow({ where: { tenantId: a, code: "IMP-001" }, include: { dueDates: true } });
      expect(asset).toMatchObject({ description: "Descripción nueva", siteId: siteA2 });
      const maintenance = asset.dueDates.find((d) => d.kind === "maintenance")!;
      expect(maintenance.dueAt.toISOString().slice(0, 10)).toBe("2027-06-30");
      const open = await db.dueItem.findMany({ where: { tenantId: a, entityId: maintenance.id, status: "open" } });
      expect(open).toHaveLength(1);
      expect(open[0].siteId).toBe(siteA2);
    });

    it("no importa un código que ya usa otra empresa y no toca activos ajenos", async () => {
      const csv = [header, "EXT-001,Otra sede,Base Neuquén,ABC,5,2022-05-10,2026-03-31"].join("\n");
      await applyAssetImport({ tenantId: b, actorUserId: actor, typeKey: "extinguisher", csv });
      const ofA = await db.asset.findFirstOrThrow({ where: { tenantId: a, code: "EXT-001" } });
      expect(ofA.description).toBe("Pasillo");
    });
  });

  describe("listado", () => {
    it("pagina por cursor, filtra y cuenta en la base", async () => {
      const first = await listAssets(a, { take: 5 });
      expect(first.items).toHaveLength(5);
      expect(first.total).toBeGreaterThan(5);
      expect(first.nextCursor).toBe(first.items[4].code);
      const second = await listAssets(a, { take: 5, after: first.nextCursor! });
      expect(second.items[0].code > first.items[4].code).toBe(true);
      expect((await listAssets(a, { q: "imp-00" })).items.every((x) => x.code.startsWith("IMP-00"))).toBe(true);
      expect((await listAssets(a, { status: "retired" })).items.map((x) => x.code)).toEqual(["BAJA-1"]);
      expect((await listAssets(a, { siteId: siteA2 })).items.every((x) => x.siteId === siteA2)).toBe(true);
    });

    it("hace la misma cantidad de consultas con 25 filas que con 5", async () => {
      const counting = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
      let queries = 0;
      counting.$on("query", () => queries++);
      try {
        await listAssets(a, { take: 5 }, counting);
        const few = queries;
        queries = 0;
        const page = await listAssets(a, { take: 25 }, counting);
        expect(page.items.length).toBeGreaterThan(5);
        expect(queries).toBe(few);
      } finally {
        await counting.$disconnect();
      }
    });
  });
});
