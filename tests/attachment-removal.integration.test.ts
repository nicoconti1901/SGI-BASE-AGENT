import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { AttachmentRemovalError, removeAttachment } from "@/lib/attachment-removal";
import { MemoryObjectStorage } from "@/lib/storage/types";
import type { AttachmentActor } from "@/domain/attachments/removal";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("attachment removal (integration)", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const slug = `att-removal-${Date.now()}`;
  let tenantId = "";
  const users = { uploader: "", other: "", manager: "" };

  const actorOf = (key: keyof typeof users, over: Partial<AttachmentActor> = {}): AttachmentActor => ({
    userId: users[key],
    canWrite: true,
    canManage: key === "manager",
    isPlatformSuperuser: false,
    ...over,
  });

  async function findingWithDoc(status: "draft" | "closed" = "draft") {
    const finding = await db.finding.create({
      data: {
        tenantId,
        type: "observation",
        status,
        title: `Hallazgo ${Math.random().toString(36).slice(2, 6)}`,
        description: "Descripción",
        detectedAt: new Date(),
      },
    });
    const key = `test/${finding.id}/foto.png`;
    await storage.putObject(key, Buffer.from("x"), "image/png");
    const attachment = await db.findingAttachment.create({
      data: {
        tenantId,
        findingId: finding.id,
        kind: "finding_doc",
        storageKey: key,
        fileName: "foto.png",
        contentType: "image/png",
        sizeBytes: 1,
        uploadedById: users.uploader,
      },
    });
    return { finding, attachment, key };
  }

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({ name: "Adjuntos SA", slug, size: "small", activity: "servicios" });
    tenantId = tenant.id;
    for (const key of ["uploader", "other", "manager"] as const) {
      const user = await db.user.create({ data: { name: key, email: `${key}@${slug}.test`, emailVerified: true } });
      users[key] = user.id;
      await db.membership.create({ data: { userId: user.id, tenantId, role: key === "manager" ? "process_owner" : "contributor" } });
    }
  });

  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await db.$disconnect();
  });

  it("removes the file, the stored object, and leaves who removed it and when", async () => {
    const { finding, attachment, key } = await findingWithDoc();
    const result = await removeAttachment({ tenantId, kind: "finding_doc", attachmentId: attachment.id, actor: actorOf("uploader"), db, storage });

    expect(result.fileName).toBe("foto.png");
    expect(await db.findingAttachment.count({ where: { id: attachment.id } })).toBe(0);
    expect(await storage.getObject(key)).toBeNull();
    const log = await db.attachmentRemoval.findFirstOrThrow({ where: { tenantId, parentId: finding.id } });
    expect(log).toMatchObject({ kind: "finding_doc", fileName: "foto.png", uploadedById: users.uploader, removedByUserId: users.uploader });
  });

  it("does not let another collaborator remove it, but a manager can", async () => {
    const { attachment } = await findingWithDoc();
    await expect(
      removeAttachment({ tenantId, kind: "finding_doc", attachmentId: attachment.id, actor: actorOf("other"), db, storage }),
    ).rejects.toBeInstanceOf(AttachmentRemovalError);
    expect(await db.findingAttachment.count({ where: { id: attachment.id } })).toBe(1);

    await removeAttachment({ tenantId, kind: "finding_doc", attachmentId: attachment.id, actor: actorOf("manager"), db, storage });
    expect(await db.findingAttachment.count({ where: { id: attachment.id } })).toBe(0);
  });

  it("keeps the files of a closed finding", async () => {
    const { attachment } = await findingWithDoc("closed");
    await expect(
      removeAttachment({ tenantId, kind: "finding_doc", attachmentId: attachment.id, actor: actorOf("manager"), db, storage }),
    ).rejects.toThrow(/cerrado/);
    expect(await db.findingAttachment.count({ where: { id: attachment.id } })).toBe(1);
  });

  it("keeps the evidence of a closed measure and rejects another tenant's file", async () => {
    const finding = await db.finding.create({
      data: { tenantId, type: "nonconformity", status: "in_progress", title: "NC", description: "d", detectedAt: new Date() },
    });
    const measure = await db.findingMeasure.create({
      data: { tenantId, findingId: finding.id, kind: "corrective", title: "Medida", ownerUserId: users.manager, status: "closed", closedAt: new Date() },
    });
    const evidence = await db.findingAttachment.create({
      data: {
        tenantId,
        findingId: finding.id,
        measureId: measure.id,
        kind: "measure_evidence",
        storageKey: "test/ev.pdf",
        fileName: "ev.pdf",
        contentType: "application/pdf",
        sizeBytes: 1,
        uploadedById: users.uploader,
      },
    });
    await expect(
      removeAttachment({ tenantId, kind: "measure_evidence", attachmentId: evidence.id, actor: actorOf("manager"), db, storage }),
    ).rejects.toThrow(/respalda su cierre/);
    await expect(
      removeAttachment({ tenantId: "otra-empresa", kind: "measure_evidence", attachmentId: evidence.id, actor: actorOf("manager"), db, storage }),
    ).rejects.toThrow(/ya no existe/);
  });
});
