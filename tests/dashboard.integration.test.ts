import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createDueItem } from "@/lib/automation";
import { getTenantDashboard } from "@/lib/dashboard";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("tenant dashboard integration", () => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const now = new Date("2026-09-30T12:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;
  let tenantId = "";
  let otherId = "";
  let objectiveId = "";
  let indicatorId = "";

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({
      name: "Dash Acme",
      slug: `dash-${stamp}`,
      size: "small",
      activity: "servicios",
    });
    tenantId = tenant.id;
    otherId = (
      await createTenantWithTemplate({
        name: "Dash Otra",
        slug: `dash-otra-${stamp}`,
        size: "small",
        activity: "servicios",
      })
    ).id;

    await createDueItem({ tenantId, title: "Vencido", entityType: "risk", entityId: "r1", dueAt: new Date(now.getTime() - 2 * day) }, db);
    await createDueItem({ tenantId, title: "Próximo", entityType: "audit_report", entityId: "a1", dueAt: new Date(now.getTime() + 3 * day) }, db);
    // Con 30 días de anticipación ya está "por vencer" aunque falten 20.
    await createDueItem({ tenantId, title: "Próximo largo", entityType: "risk", entityId: "r2", dueAt: new Date(now.getTime() + 20 * day), leadDays: 30 }, db);
    const objective = await db.objective.create({
      data: { tenantId, code: "OBJ-1", title: "Objetivo dash", standards: ["ISO9001"], ownerUserId: "owner-dash", dueDate: new Date(now.getTime() + 90 * day) },
    });
    objectiveId = objective.id;
    const indicator = await db.indicator.create({
      data: { tenantId, objectiveId, name: "Indicador dash", unit: "%", direction: "higher_better", target: 90, frequency: "monthly", kind: "lagging", ownerUserId: "owner-dash" },
    });
    indicatorId = indicator.id;
    await createDueItem({ tenantId, title: "Lejano", entityType: "indicator_measurement", entityId: indicatorId, dueAt: new Date(now.getTime() + 60 * day) }, db);
    await createDueItem({ tenantId, title: "Cerrado", entityType: "risk", dueAt: new Date(now.getTime() - 5 * day) }, db);
    await db.dueItem.updateMany({ where: { tenantId, title: "Cerrado" }, data: { status: "closed" } });
    await createDueItem({ tenantId: otherId, title: "De otra empresa", entityType: "risk", dueAt: new Date(now.getTime() - day) }, db);
  });

  afterAll(async () => {
    for (const id of [tenantId, otherId]) {
      await db.dueItem.deleteMany({ where: { tenantId: id } });
      await db.indicator.deleteMany({ where: { tenantId: id } });
      await db.objective.deleteMany({ where: { tenantId: id } });
      await db.tenantRequirement.deleteMany({ where: { tenantId: id } });
      await db.tenant.deleteMany({ where: { id } });
    }
    await db.$disconnect();
  });

  it("lista solo vencimientos abiertos de la empresa, ordenados por fecha, con conteos", async () => {
    const d = await getTenantDashboard(tenantId, now, `dash-${stamp}`, db);
    expect(d.dueItems.map((i) => i.title)).toEqual(["Vencido", "Próximo", "Próximo largo", "Lejano"]);
    expect(d.dueCounts).toEqual({ overdue: 1, soon: 2, open: 4 });
    const largo = await db.dueItem.findFirstOrThrow({ where: { tenantId, title: "Próximo largo" } });
    expect(largo.remindAt.toISOString()).toBe(new Date(now.getTime() - 10 * day).toISOString());
    expect(d.dueItems[0].href).toBe(`/t/dash-${stamp}/risks/r1`);
    expect(d.dueItems[3].href).toBe(`/t/dash-${stamp}/indicators/${objectiveId}/${indicatorId}`);
  });

  it("resume el cumplimiento de los requisitos de la empresa", async () => {
    const reqs = await db.tenantRequirement.findMany({ where: { tenantId }, take: 2 });
    expect(reqs.length).toBe(2);
    await db.tenantRequirement.update({ where: { id: reqs[0].id }, data: { status: "compliant" } });
    await db.tenantRequirement.update({ where: { id: reqs[1].id }, data: { status: "not_applicable" } });
    const d = await getTenantDashboard(tenantId, now, `dash-${stamp}`, db);
    expect(d.compliance.total).toBeGreaterThan(2);
    expect(d.compliance.byStatus.compliant).toBe(1);
    expect(d.compliance.byStatus.not_applicable).toBe(1);
    expect(d.compliance.applicable).toBe(d.compliance.total - 1);
  });
});

describe.skipIf(!hasDatabase)("destino de los vencimientos que dependen de otro registro", () => {
  const db = new PrismaClient();
  const slug = `dash-dest-${Date.now()}`;
  const dueAt = new Date("2031-01-10T12:00:00.000Z");
  let tenantId = "";
  let assetId = "";
  let supplierId = "";

  beforeAll(async () => {
    tenantId = (await createTenantWithTemplate({ name: "Dash Destinos", slug, size: "small", activity: "servicios" })).id;
    const site = await db.site.create({ data: { tenantId, name: "Planta" } });
    assetId = (await db.asset.create({ data: { tenantId, siteId: site.id, typeKey: "extinguisher", code: "EXT-1", description: "Matafuego", attributes: {} } })).id;
    const assetDue = await db.assetDueDate.create({ data: { tenantId, assetId, kind: "charge", dueAt } });
    const impact = await db.impactAssessment.create({ data: { tenantId, assetId, trigger: "functional_check_failed", windowTo: dueAt } });
    supplierId = (await db.supplier.create({ data: { tenantId, legalName: "Proveedor SA", type: "service" } })).id;
    const docType = await db.supplierDocumentType.create({ data: { tenantId, key: "art", name: "ART" } });
    const document = await db.supplierDocument.create({
      data: { tenantId, supplierId, typeId: docType.id, storageKey: "k", fileName: "art.pdf", contentType: "application/pdf", sizeBytes: 1 },
    });
    for (const [entityType, entityId] of [
      ["asset_due_date", assetDue.id],
      ["instrument_impact", impact.id],
      ["supplier_document", document.id],
    ] as const) {
      await createDueItem({ tenantId, title: entityType, entityType, entityId, dueAt }, db);
    }
  });

  afterAll(async () => {
    await db.dueItem.deleteMany({ where: { tenantId } });
    await db.supplierDocument.deleteMany({ where: { tenantId } });
    await db.supplierDocumentType.deleteMany({ where: { tenantId } });
    await db.supplier.deleteMany({ where: { tenantId } });
    await db.impactAssessment.deleteMany({ where: { tenantId } });
    await db.assetDueDate.deleteMany({ where: { tenantId } });
    await db.asset.deleteMany({ where: { tenantId } });
    await db.site.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  it("lleva al activo, al equipo y al proveedor", async () => {
    const { dueItems } = await getTenantDashboard(tenantId, new Date("2031-01-01T12:00:00.000Z"), slug, db);

    expect(Object.fromEntries(dueItems.map((d) => [d.title, d.href]))).toEqual({
      asset_due_date: `/t/${slug}/assets/${assetId}`,
      instrument_impact: `/t/${slug}/instruments/${assetId}`,
      supplier_document: `/t/${slug}/suppliers/${supplierId}`,
    });
  });
});
