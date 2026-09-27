import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type FindingType } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { closeFindingMeasure } from "@/lib/findings";
import {
  FindingGateError,
  addFindingMeasure,
  cancelFinding,
  recalculateFindingStatuses,
  reopenFinding,
  rescheduleVerification,
  startFindingMeasure,
  verifyFinding,
} from "@/lib/finding-lifecycle";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("finding lifecycle (integration)", () => {
  const db = new PrismaClient();
  const slug = `lifecycle-${Date.now()}`;
  let tenantId = "";
  const users: Record<"admin" | "owner" | "sst", string> = { admin: "", owner: "", sst: "" };

  /** Hallazgo publicado con medidas abiertas, como lo deja publishFinding. */
  async function publishedFinding(type: FindingType, owners: string[]) {
    const finding = await db.finding.create({
      data: {
        tenantId,
        type,
        status: "published",
        title: `Caída desde andamio ${Math.random().toString(36).slice(2, 6)}`,
        description: "Operario cayó desde 2,4 m",
        detectedAt: new Date(),
        publishedAt: new Date(),
        measures: {
          create: owners.map((ownerUserId, i) => ({
            tenantId,
            kind: "corrective" as const,
            title: `Medida ${i + 1}`,
            ownerUserId,
            dueAt: new Date("2031-01-01"),
            linkedRootCause: true,
          })),
        },
      },
      include: { measures: true },
    });
    return finding;
  }

  async function closeWithEvidence(findingId: string, measureId: string, actor: string) {
    await db.findingAttachment.create({
      data: {
        tenantId,
        findingId,
        measureId,
        kind: "measure_evidence",
        storageKey: "test/evidencia.pdf",
        fileName: "evidencia.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
      },
    });
    await closeFindingMeasure({ tenantId, measureId, actorUserId: actor, db });
  }

  const status = async (id: string) => (await db.finding.findUniqueOrThrow({ where: { id } })).status;

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({ name: "Lifecycle SA", slug, size: "small", activity: "servicios" });
    tenantId = tenant.id;
    for (const [key, role] of [["admin", "tenant_admin"], ["owner", "contributor"], ["sst", "process_owner"]] as const) {
      const user = await db.user.create({ data: { name: key, email: `${key}@${slug}.test`, emailVerified: true } });
      users[key] = user.id;
      await db.membership.create({ data: { userId: user.id, tenantId, role } });
    }
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await db.$disconnect();
  });

  it("walks an incident from published to closed with verified effectiveness", async () => {
    const f = await publishedFinding("incident", [users.owner, users.owner]);
    const [m1, m2] = f.measures;

    await startFindingMeasure({ tenantId, measureId: m1.id, actorUserId: users.owner }, db);
    expect(await status(f.id)).toBe("in_progress");

    await closeWithEvidence(f.id, m1.id, users.owner);
    expect(await status(f.id)).toBe("in_progress");
    await closeWithEvidence(f.id, m2.id, users.owner);
    expect(await status(f.id)).toBe("verification");

    const due = await db.dueItem.findFirst({
      where: { tenantId, entityType: "finding_verification", entityId: f.id, status: "open" },
    });
    expect(due).not.toBeNull();

    // P3: el único responsable de todas las medidas no puede verificar sin excepción.
    await expect(
      verifyFinding(
        { tenantId, findingId: f.id, actorUserId: users.owner, result: "effective", evidence: "Sin recurrencia", independenceException: null, earlyReason: "Prueba" },
        db,
      ),
    ).rejects.toBeInstanceOf(FindingGateError);

    // P2: antes de la fecha programada pide motivo.
    const early = await verifyFinding(
      { tenantId, findingId: f.id, actorUserId: users.sst, result: "effective", evidence: "Sin recurrencia", independenceException: null, earlyReason: null },
      db,
    ).catch((e) => e);
    expect((early as FindingGateError).issues[0]).toMatch(/más adelante/);

    await rescheduleVerification({ tenantId, findingId: f.id, dueAt: new Date(Date.now() - 1000) }, db);
    await verifyFinding(
      { tenantId, findingId: f.id, actorUserId: users.sst, result: "effective", evidence: "Se revisaron 12 trabajos en altura sin desvíos", independenceException: null, earlyReason: null },
      db,
    );
    const closed = await db.finding.findUniqueOrThrow({ where: { id: f.id } });
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).not.toBeNull();
    expect(await db.dueItem.count({ where: { entityId: f.id, entityType: "finding_verification", status: "open" } })).toBe(0);

    const events = await db.findingStatusEvent.findMany({ where: { findingId: f.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.toStatus)).toEqual(["in_progress", "verification", "closed"]);
  });

  it("ineffective verification requires a new corrective measure", async () => {
    const f = await publishedFinding("nonconformity", [users.owner]);
    await closeWithEvidence(f.id, f.measures[0].id, users.owner);
    expect(await status(f.id)).toBe("verification");

    await verifyFinding(
      { tenantId, findingId: f.id, actorUserId: users.sst, result: "not_effective", evidence: "Se repitió el 12/11", independenceException: null, earlyReason: "Recurrencia" },
      db,
    );
    const back = await db.finding.findUniqueOrThrow({ where: { id: f.id } });
    expect(back.status).toBe("in_progress");
    expect(back.reworkSince).not.toBeNull();
    // Las medidas viejas siguen cerradas, pero no alcanza: hace falta una nueva.
    await recalculateFindingStatuses(tenantId, db);
    expect(await status(f.id)).toBe("in_progress");

    const extra = await addFindingMeasure(
      {
        tenantId,
        findingId: f.id,
        actorUserId: users.sst,
        measure: { kind: "corrective", title: "Línea de vida fija", ownerUserId: users.admin, dueAt: new Date("2031-02-01"), linkedRootCause: true },
      },
      db,
    );
    await closeWithEvidence(f.id, extra.id, users.admin);
    expect(await status(f.id)).toBe("verification");
    expect(await db.findingVerification.count({ where: { findingId: f.id } })).toBe(1);
  });

  it("closes observations without verification", async () => {
    const f = await publishedFinding("observation", [users.owner]);
    await closeWithEvidence(f.id, f.measures[0].id, users.owner);
    expect(await status(f.id)).toBe("closed");
  });

  it("cancels with a reason and closes pending due items", async () => {
    const f = await publishedFinding("nonconformity", [users.owner]);
    await db.dueItem.create({
      data: { tenantId, title: "Medida", entityType: "finding_measure", entityId: f.measures[0].id, dueAt: new Date("2031-01-01") },
    });
    await expect(
      cancelFinding({ tenantId, findingId: f.id, actorUserId: users.admin, reason: " " }, db),
    ).rejects.toBeInstanceOf(FindingGateError);
    await cancelFinding({ tenantId, findingId: f.id, actorUserId: users.admin, reason: "Duplicado del hallazgo 0141" }, db);
    const cancelled = await db.finding.findUniqueOrThrow({ where: { id: f.id } });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelReason).toBe("Duplicado del hallazgo 0141");
    expect(await db.dueItem.count({ where: { entityId: f.measures[0].id, status: "open" } })).toBe(0);
    // Anulado: sus medidas ya no se gestionan.
    await expect(
      startFindingMeasure({ tenantId, measureId: f.measures[0].id, actorUserId: users.owner }, db),
    ).rejects.toBeInstanceOf(FindingGateError);
  });

  it("reopens a closed finding and asks for a new corrective measure", async () => {
    const f = await publishedFinding("observation", [users.owner]);
    await closeWithEvidence(f.id, f.measures[0].id, users.owner);
    await reopenFinding({ tenantId, findingId: f.id, actorUserId: users.admin, reason: "Volvió a ocurrir en nave 3" }, db);
    const reopened = await db.finding.findUniqueOrThrow({ where: { id: f.id } });
    expect(reopened.status).toBe("in_progress");
    expect(reopened.closedAt).toBeNull();
    await expect(
      reopenFinding({ tenantId, findingId: f.id, actorUserId: users.admin, reason: "otra vez" }, db),
    ).rejects.toThrow(/reabrir/);
  });
});
