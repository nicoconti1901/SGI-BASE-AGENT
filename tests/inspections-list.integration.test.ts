import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createSite } from "@/lib/masterdata";
import { createAsset } from "@/lib/assets";
import { addInspectionPhoto, closeInspection, getInspectionView, saveAnswer, startInspection } from "@/lib/inspections";
import { exportInspectionRows, inspectionCounters, listDuePlans, listInspections } from "@/lib/inspection-list";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { addDays, dateFromIso, todayIso } from "@/domain/inspections/dates";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("lista, contadores y exportación de inspecciones (integración)", () => {
  const db = new PrismaClient();
  const queries = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  const storage = new MemoryObjectStorage();
  const stamp = Date.now();
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let ines = "";
  let omar = "";
  let siteBase = "";
  let siteNorte = "";
  const assets: Record<string, string> = {};

  const newAsset = (siteId: string, code: string) =>
    createAsset({
      tenantId: a,
      actorUserId: ines,
      typeKey: "extinguisher",
      code: `${code}-${stamp % 100000}`,
      description: `Extintor ${code}`,
      siteId,
      attributes: { agent: "abc", capacityKg: 5, manufacturedAt: "2022-05-10" },
      dueDates: [{ kind: "maintenance", lastDoneAt: "2026-03-31" }],
    });

  async function inspect(assetId: string, who: string, nonconform: string[] = []) {
    const { id } = await startInspection({ tenantId: a, actorUserId: who, assetId });
    const view = (await getInspectionView(a, id))!;
    for (const row of view.items.filter((i) => !i.answer.autoDerived && i.item.kind === "check")) {
      const bad = nonconform.includes(row.item.code);
      await saveAnswer({ tenantId: a, actorUserId: who, canEditOthers: false, inspectionId: id, itemId: row.item.id, patch: { value: bad ? "nonconform" : "conform", ...(bad ? { comment: "Mal" } : {}) } });
      if (bad && row.item.photoOnNc) await addInspectionPhoto({ tenantId: a, actorUserId: who, canEditOthers: false, inspectionId: id, itemId: row.item.id, fileName: "f.jpg", contentType: "image/jpeg", body: Buffer.from("jpeg"), storage });
    }
    await closeInspection({ tenantId: a, actorUserId: who, canEditOthers: false, inspectionId: id });
    return id;
  }

  beforeAll(async () => {
    for (const label of ["a", "b"]) {
      const t = await createTenantWithTemplate({ name: `InspL ${label}`, slug: `inspl-${label}-${stamp}`, size: "small", activity: "servicios" });
      tenantIds.push(t.id);
    }
    [a, b] = tenantIds;
    ines = (await db.user.create({ data: { name: "Inés", email: `inspl-${stamp}@test.dev`, emailVerified: true } })).id;
    omar = (await db.user.create({ data: { name: "Omar", email: `inspl-o-${stamp}@test.dev`, emailVerified: true } })).id;
    siteBase = (await createSite({ tenantId: a, actorUserId: ines, name: "Base" })).id;
    siteNorte = (await createSite({ tenantId: a, actorUserId: ines, name: "Norte" })).id;
    for (const [key, site] of [["A1", siteBase], ["A2", siteBase], ["N1", siteNorte]] as const) assets[key] = (await newAsset(site, key)).id;
    await inspect(assets.A1, ines); // apta, Base
    await inspect(assets.A2, ines, ["state_seal"]); // no apta, Base
    await inspect(assets.N1, omar, ["loc_mount"]); // con observaciones, Norte
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [ines, omar] } } });
    await db.$disconnect();
    await queries.$disconnect();
  });

  describe("filtros", () => {
    const list = async (filter = {}) => (await listInspections(a, filter)).items;

    it("sin filtro trae todas; por resultado, sede, inspector y tipo", async () => {
      expect(await list()).toHaveLength(3);
      expect((await list({ result: "unfit" })).map((i) => i.asset?.code)).toEqual([expect.stringContaining("A2")]);
      expect(await list({ siteId: siteNorte })).toHaveLength(1);
      expect(await list({ inspectorUserId: omar })).toHaveLength(1);
      const template = await db.inspectionTemplate.findFirstOrThrow({ where: { tenantId: a, key: "extinguisher_periodic" } });
      expect(await list({ templateId: template.id })).toHaveLength(3);
      expect(await list({ templateId: "no-existe" })).toHaveLength(0);
    });

    it("el activo se busca por parte del código, sin distinguir mayúsculas", async () => {
      expect((await list({ assetCode: "a1-" })).map((i) => i.asset?.code)).toEqual([expect.stringMatching(/^A1-/)]);
      expect(await list({ assetCode: "zzz" })).toHaveLength(0);
    });

    it("las fechas incluyen los dos extremos", async () => {
      const today = todayIso();
      expect(await list({ from: today, to: today })).toHaveLength(3);
      expect(await list({ from: addDays(today, 1) })).toHaveLength(0);
      expect(await list({ to: addDays(today, -1) })).toHaveLength(0);
    });

    it("las páginas por cursor no repiten ni se saltean filas, con filtros", async () => {
      const seen: string[] = [];
      let after: string | undefined;
      for (let i = 0; i < 5; i++) {
        const page = await listInspections(a, { take: 2, after });
        seen.push(...page.items.map((x) => x.id));
        if (!page.nextCursor) break;
        after = page.nextCursor;
      }
      expect(seen).toHaveLength(3);
      expect(new Set(seen).size).toBe(3);
    });

    it("otra empresa no ve nada", async () => {
      expect((await listInspections(b)).items).toHaveLength(0);
      expect((await listInspections(b, { assetCode: "A1" })).items).toHaveLength(0);
    });
  });

  describe("contadores y programas", () => {
    it("cuentan vencidas, próximas, no aptas y fuera de servicio de la empresa", async () => {
      const before = await inspectionCounters(a);
      expect(before).toMatchObject({ overdue: 0, unfit: 1, outOfService: 1 });
      expect(before.upcoming).toBe(1); // A2 no apta: reinspección a 7 días; A1 y N1 vencen en un mes

      await db.inspectionPlan.updateMany({ where: { tenantId: a, assetId: assets.A1 }, data: { nextDueAt: dateFromIso(addDays(todayIso(), -3)) } });
      const after = await inspectionCounters(a);
      expect(after.overdue).toBe(1);
      expect(await inspectionCounters(b)).toMatchObject({ overdue: 0, upcoming: 0, unfit: 0, outOfService: 0 });
    });

    it("lista los programas vencidos y los próximos, del más atrasado al más próximo", async () => {
      const overdue = await listDuePlans(a, { kind: "overdue" });
      expect(overdue.items.map((p) => p.asset?.code)).toEqual([expect.stringMatching(/^A1-/)]);
      expect(overdue.items[0].dueIso).toBe(addDays(todayIso(), -3));

      const upcoming = await listDuePlans(a, { kind: "upcoming" });
      expect(upcoming.items.map((p) => p.asset?.code)).toEqual([expect.stringMatching(/^A2-/)]);
      expect((await listDuePlans(b, { kind: "overdue" })).items).toHaveLength(0);
    });

    it("pagina los programas por cursor", async () => {
      for (const [key, days] of [["A2", -2], ["N1", -1]] as const) {
        await db.inspectionPlan.updateMany({ where: { tenantId: a, assetId: assets[key] }, data: { nextDueAt: dateFromIso(addDays(todayIso(), days)) } });
      }
      const first = await listDuePlans(a, { kind: "overdue", take: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      const second = await listDuePlans(a, { kind: "overdue", take: 2, after: first.nextCursor! });
      expect(second.items).toHaveLength(1);
      expect(new Set([...first.items, ...second.items].map((p) => p.id)).size).toBe(3);
    });
  });

  describe("exportación", () => {
    it("exporta lo mismo que la lista con los mismos filtros", async () => {
      const all = await exportInspectionRows(a);
      expect(all.truncated).toBe(false);
      expect(all.rows).toHaveLength(3);
      const unfit = await exportInspectionRows(a, { result: "unfit" });
      expect(unfit.rows).toMatchObject([{ result: "unfit", hasAction: true, hasFinding: false, siteName: "Base", inspectorName: "Inés" }]);
      expect((await exportInspectionRows(b)).rows).toHaveLength(0);
    });
  });

  it("la cantidad de consultas de la lista no depende del tamaño de la página", async () => {
    const counted = async (take: number) => {
      let n = 0;
      queries.$on("query" as never, () => void n++);
      n = 0;
      await listInspections(a, { take }, queries);
      return n;
    };
    const small = await counted(1);
    const large = await counted(25);
    expect(large).toBe(small);
  });
});
