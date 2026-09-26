import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { createFindingDraft, publishFinding } from "@/lib/findings";
import {
  confirmRootCause,
  createInitialWhyStep,
} from "@/domain/findings/five-whys";
import { FINDING_MEASURE_ENTITY_TYPE } from "@/domain/findings/types";
import { MemoryEmailSender, setEmailSenderForTests } from "@/lib/mail";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("findings publish integration", () => {
  const db = new PrismaClient();
  const mail = new MemoryEmailSender();
  const slug = `find-${Date.now()}`;
  let tenantId = "";
  let ownerId = "";
  let notifyId = "";

  beforeAll(async () => {
    setEmailSenderForTests(mail);
    const tenant = await createTenantWithTemplate({
      name: "Findings Acme",
      slug,
      size: "small",
      activity: "servicios",
    });
    tenantId = tenant.id;

    const owner = await db.user.create({
      data: {
        name: "Owner",
        email: `owner@${slug}.test`,
        emailVerified: true,
      },
    });
    const notify = await db.user.create({
      data: {
        name: "Notify",
        email: `notify@${slug}.test`,
        emailVerified: true,
      },
    });
    ownerId = owner.id;
    notifyId = notify.id;
    await db.membership.createMany({
      data: [
        { userId: ownerId, tenantId, role: "contributor" },
        { userId: notifyId, tenantId, role: "tenant_admin" },
      ],
    });
  });

  afterAll(async () => {
    setEmailSenderForTests(null);
    await db.inAppNotification.deleteMany({ where: { tenantId } });
    await db.dueItem.deleteMany({ where: { tenantId } });
    await db.findingMeasure.deleteMany({ where: { tenantId } });
    await db.findingNotifyRecipient.deleteMany({
      where: { finding: { tenantId } },
    });
    await db.finding.deleteMany({ where: { tenantId } });
    await db.membership.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: { in: [ownerId, notifyId] } } });
    await db.$disconnect();
  });

  it("publishes with root cause, due items and targeted notifications", async () => {
    const finding = await createFindingDraft({
      tenantId,
      type: "nonconformity",
      title: "Producto fuera de especificación",
      description: "Lote L-22 rechazado en control final",
      detectedAt: new Date("2026-09-20"),
      createdByUserId: notifyId,
      source: "control calidad",
      db,
    });

    const first = createInitialWhyStep(finding.description);
    const rca = confirmRootCause(
      [
        {
          ...first,
          answer: "Medición fuera de tolerancia registrada",
        },
        {
          id: "s2",
          order: 2,
          branchId: first.branchId,
          branchLabel: first.branchLabel,
          question: "¿Por qué?",
          answer: "Instrumento sin verificación vigente",
          isRootCause: false,
        },
        {
          id: "s3",
          order: 3,
          branchId: first.branchId,
          branchLabel: first.branchLabel,
          question: "¿Por qué?",
          answer: "No existe procedimiento de control metrológico",
          isRootCause: true,
        },
      ],
      notifyId,
      finding.description,
    );

    const published = await publishFinding({
      tenantId,
      findingId: finding.id,
      actorUserId: notifyId,
      db,
      draft: {
        type: "nonconformity",
        title: finding.title,
        description: finding.description,
        detectedAt: finding.detectedAt,
        source: finding.source ?? undefined,
        rca,
        measures: [
          {
            kind: "corrective",
            title: "Emitir procedimiento metrológico",
            ownerUserId: ownerId,
            dueAt: new Date("2026-10-15"),
            linkedRootCause: true,
          },
        ],
        notifyUserIds: [notifyId],
      },
    });

    expect(published.status).toBe("published");
    expect(published.rootCause).toContain("metrológico");

    const dues = await db.dueItem.findMany({
      where: {
        tenantId,
        entityType: FINDING_MEASURE_ENTITY_TYPE,
        status: "open",
      },
    });
    expect(dues.length).toBe(1);

    const notes = await db.inAppNotification.findMany({ where: { tenantId } });
    const userIds = new Set(notes.map((n) => n.userId));
    expect(userIds.has(notifyId)).toBe(true);
    expect(userIds.has(ownerId)).toBe(true);
    expect(mail.sent.length).toBeGreaterThanOrEqual(1);
  });
});
