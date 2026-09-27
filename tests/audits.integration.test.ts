import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import {
  AuditGateError,
  approveProgram,
  createAudit,
  getProgramCoverage,
  getProgramWithAudits,
  saveAuditPlan,
  saveAuditReport,
  saveProgram,
  transitionAudit,
  type AuditPlanDraft,
} from "@/lib/audits";
import {
  addCustomQuestion,
  getChecklist,
  listChecklistCandidates,
  readAuditEvidenceFile,
  recordItemResult,
  setRequirementItems,
  uploadAuditEvidence,
} from "@/lib/audit-checklist";
import { MemoryObjectStorage } from "@/lib/storage/types";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("audits program and planning (integration)", () => {
  const db = new PrismaClient();
  const slug = `audit-${Date.now()}`;
  let tenantId = "";
  const userIds: string[] = [];

  const plan = (overrides: Partial<AuditPlanDraft> = {}): AuditPlanDraft => ({
    title: "Despacho",
    objective: "Verificar que despacho cumple requisitos del cliente",
    scope: "Despacho, planta 1",
    standards: ["ISO9001", "ISO45001"],
    plannedStart: new Date("2031-03-10"),
    plannedEnd: new Date("2031-03-11"),
    mode: "onsite",
    leadUserId: userIds[0],
    auditorUserIds: [],
    auditees: [{ userId: userIds[1], area: "Despacho" }],
    impartialityException: null,
    ...overrides,
  });

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({
      name: "Audit Acme",
      slug,
      size: "small",
      activity: "servicios",
    });
    tenantId = tenant.id;
    for (const name of ["lead", "auditee"]) {
      const user = await db.user.create({
        data: { name, email: `${name}@${slug}.test`, emailVerified: true },
      });
      userIds.push(user.id);
      await db.membership.create({
        data: { userId: user.id, tenantId, role: "process_owner" },
      });
    }
  });

  afterAll(async () => {
    // Borrar el tenant cascadea auditorías, programa, vencimientos y membresías.
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("creates audits with correlative codes, a program and due items", async () => {
    const a = await createAudit({
      tenantId,
      title: "Compras",
      plannedStart: new Date("2031-02-01"),
      plannedEnd: new Date("2031-02-02"),
      createdByUserId: userIds[0],
    });
    const b = await createAudit({
      tenantId,
      title: "Despacho",
      plannedStart: new Date("2031-03-10"),
      plannedEnd: new Date("2031-03-11"),
      createdByUserId: userIds[0],
    });
    expect([a.code, b.code]).toEqual(["AI-2031-01", "AI-2031-02"]);

    const { program, audits } = await getProgramWithAudits(tenantId, 2031, db);
    expect(program?.status).toBe("draft");
    expect(audits).toHaveLength(2);

    const due = await db.dueItem.findMany({ where: { tenantId, entityId: a.id } });
    expect(due.map((d) => d.entityType).sort()).toEqual(["audit_report", "audit_start"]);
  });

  it("rejects people outside the company and blocks preparing without checklist", async () => {
    const audit = await createAudit({
      tenantId,
      title: "Mantenimiento",
      plannedStart: new Date("2031-04-01"),
      plannedEnd: new Date("2031-04-01"),
      createdByUserId: userIds[0],
    });

    await expect(
      saveAuditPlan({ tenantId, auditId: audit.id, plan: plan({ leadUserId: "ajeno" }) }, db),
    ).rejects.toBeInstanceOf(AuditGateError);

    await saveAuditPlan({ tenantId, auditId: audit.id, plan: plan() }, db);
    const err = await transitionAudit({ tenantId, auditId: audit.id, to: "prepared" }, db).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(AuditGateError);
    expect((err as AuditGateError).issues).toEqual([
      "Agregá al menos un ítem a la lista de verificación",
    ]);
  });

  it("requires objectives and audits to approve; editing sends it back to draft", async () => {
    await expect(approveProgram({ tenantId, year: 2031, userId: userIds[0] }, db)).rejects.toThrow(
      /objetivos/,
    );
    await saveProgram(
      { tenantId, year: 2031, objectives: "Cubrir todos los procesos", frequencyRationale: "" },
      db,
    );
    const approved = await approveProgram({ tenantId, year: 2031, userId: userIds[0] }, db);
    expect(approved.status).toBe("approved");

    const edited = await saveProgram(
      { tenantId, year: 2031, objectives: "Cubrir procesos críticos", frequencyRationale: "" },
      db,
    );
    expect(edited.status).toBe("draft");
  });

  it("cancels only with a reason and closes its due items", async () => {
    const audit = await createAudit({
      tenantId,
      title: "Calibración",
      plannedStart: new Date("2031-05-01"),
      plannedEnd: new Date("2031-05-01"),
      createdByUserId: userIds[0],
    });
    await expect(
      transitionAudit({ tenantId, auditId: audit.id, to: "cancelled" }, db),
    ).rejects.toBeInstanceOf(AuditGateError);

    await transitionAudit({ tenantId, auditId: audit.id, to: "cancelled", reason: "Proceso tercerizado" }, db);
    const open = await db.dueItem.count({ where: { tenantId, entityId: audit.id, status: "open" } });
    expect(open).toBe(0);
  });

  it("does not leak audits across tenants", async () => {
    const { audits } = await getProgramWithAudits("otro-tenant", 2031, db);
    expect(audits).toHaveLength(0);
  });

  it("builds the checklist from the catalog and runs it with evidence", async () => {
    const audit = await createAudit({
      tenantId,
      title: "Planificación",
      plannedStart: new Date("2031-06-01"),
      plannedEnd: new Date("2031-06-02"),
      createdByUserId: userIds[0],
    });
    await saveAuditPlan({ tenantId, auditId: audit.id, plan: plan({ standards: ["ISO9001"] }) }, db);

    const candidates = await listChecklistCandidates(tenantId, ["ISO9001"], db);
    const clause61 = candidates.find((c) => c.clauseCode === "6.1");
    expect(clause61).toBeDefined();
    const clause42 = candidates.find((c) => c.clauseCode === "4.2");

    await addCustomQuestion({ tenantId, auditId: audit.id, question: "¿Balanzas calibradas?" }, db);
    await setRequirementItems(
      { tenantId, auditId: audit.id, tenantRequirementIds: [clause61!.tenantRequirementId, clause42!.tenantRequirementId] },
      db,
    );
    let items = await getChecklist(tenantId, audit.id, db);
    // 6.1 se divide en riesgos + oportunidades; la pregunta propia se conserva al final.
    expect(items.map((i) => i.question)).toEqual([
      "4.2 · " + clause42!.title,
      expect.stringMatching(/6.1.2/),
      expect.stringMatching(/6.1.3/),
      "¿Balanzas calibradas?",
    ]);

    await transitionAudit({ tenantId, auditId: audit.id, to: "prepared" }, db);
    await expect(
      transitionAudit({ tenantId, auditId: audit.id, to: "in_progress" }, db),
    ).rejects.toBeInstanceOf(AuditGateError);
    await transitionAudit({ tenantId, auditId: audit.id, to: "in_progress", reason: "Prueba" }, db);

    const [first, ...rest] = items;
    await expect(
      recordItemResult({ tenantId, auditId: audit.id, itemId: first.id, result: "nc_minor", evidence: "", userId: userIds[0] }, db),
    ).rejects.toThrow(/evidencia/);
    await recordItemResult(
      { tenantId, auditId: audit.id, itemId: first.id, result: "nc_minor", evidence: "2 OC sin proveedor evaluado", userId: userIds[0] },
      db,
    );
    for (const item of rest) {
      await recordItemResult({ tenantId, auditId: audit.id, itemId: item.id, result: "conforming", evidence: null, userId: userIds[0] }, db);
    }

    const storage = new MemoryObjectStorage();
    const attachment = await uploadAuditEvidence({
      tenantId,
      auditId: audit.id,
      itemId: first.id,
      fileName: "orden compra.pdf",
      contentType: "application/pdf",
      body: Buffer.from("%PDF-1.4 prueba"),
      uploadedById: userIds[0],
      db,
      storage,
    });
    const file = await readAuditEvidenceFile(attachment.id, { db, storage });
    expect(file?.attachment.fileName).toBe("orden compra.pdf");

    items = await getChecklist(tenantId, audit.id, db);
    expect(items.every((i) => i.result !== "pending")).toBe(true);

    // La NC creó un Hallazgo en borrador vinculado a la auditoría.
    const finding = items[0].finding;
    expect(finding).toMatchObject({ status: "draft", type: "nonconformity", severity: "minor" });
    const stored = await db.finding.findUniqueOrThrow({ where: { id: finding!.id } });
    expect(stored.auditId).toBe(audit.id);
    expect(stored.source).toMatch(/^Auditoría interna AI-2031-/);
    expect(stored.description).toBe("2 OC sin proveedor evaluado");

    await transitionAudit({ tenantId, auditId: audit.id, to: "reporting" }, db);

    // Cerrar exige conclusión; al cerrar, los requisitos cuentan para la cobertura.
    await expect(
      transitionAudit({ tenantId, auditId: audit.id, to: "closed" }, db),
    ).rejects.toBeInstanceOf(AuditGateError);
    await saveAuditReport(
      {
        tenantId,
        auditId: audit.id,
        conclusion: "La planificación cumple, con una NC menor en riesgos",
        strengths: "",
        workersCommunicated: true,
      },
      db,
    );
    const closed = await transitionAudit({ tenantId, auditId: audit.id, to: "closed" }, db);
    expect(closed.reportIssuedAt).not.toBeNull();
    // Sin ISO 45001 en la auditoría, la marca de comunicación a trabajadores no aplica.
    expect(closed.workersCommunicated).toBe(false);

    const coverage = await getProgramCoverage(tenantId, 2031, db);
    const iso9001 = coverage.find((row) => row.standard === "ISO9001");
    expect(iso9001?.covered).toBe(2);
  });

  it("keeps the draft finding in sync with the item result", async () => {
    const audit = await createAudit({
      tenantId,
      title: "Sincronía de hallazgos",
      plannedStart: new Date("2031-07-01"),
      plannedEnd: new Date("2031-07-01"),
      createdByUserId: userIds[0],
    });
    await saveAuditPlan({ tenantId, auditId: audit.id, plan: plan({ standards: ["ISO9001"] }) }, db);
    await addCustomQuestion({ tenantId, auditId: audit.id, question: "¿Registros de capacitación al día?" }, db);
    await transitionAudit({ tenantId, auditId: audit.id, to: "prepared" }, db);
    await transitionAudit({ tenantId, auditId: audit.id, to: "in_progress", reason: "Prueba" }, db);
    const [item] = await getChecklist(tenantId, audit.id, db);
    const record = (result: "observation" | "improvement" | "conforming", evidence: string | null) =>
      recordItemResult({ tenantId, auditId: audit.id, itemId: item.id, result, evidence, userId: userIds[0] }, db);

    const first = await record("observation", "Planilla sin firma");
    const findingId = first.findingId!;
    // Cambiar a otro tipo de hallazgo actualiza el mismo borrador.
    const second = await record("improvement", "Podría digitalizarse");
    expect(second.findingId).toBe(findingId);
    expect((await db.finding.findUniqueOrThrow({ where: { id: findingId } })).type).toBe("opportunity");

    // Pasar a conforme elimina el borrador.
    const third = await record("conforming", null);
    expect(third.findingId).toBeNull();
    expect(await db.finding.count({ where: { id: findingId } })).toBe(0);

    // Publicado, el resultado ya no se cambia desde la auditoría.
    const fourth = await record("observation", "Planilla sin firma");
    await db.finding.update({ where: { id: fourth.findingId! }, data: { status: "published" } });
    await expect(record("conforming", null)).rejects.toThrow(/anulalo desde Hallazgos/);
  });
});
