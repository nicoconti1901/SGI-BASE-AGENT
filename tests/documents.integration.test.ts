import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantWithTemplate } from "@/lib/tenant-provisioning";
import { uploadTenantDocument, readDocumentFile } from "@/lib/documents";
import { MemoryObjectStorage } from "@/lib/storage/types";
import { DocumentKeepProtectedError } from "@/domain/documents/versioning";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("document control integration", () => {
  const db = new PrismaClient();
  const storage = new MemoryObjectStorage();
  const slug = `docs-${Date.now()}`;
  let tenantId = "";
  let userId = "";
  let requirementId = "";

  beforeAll(async () => {
    const tenant = await createTenantWithTemplate({
      name: "Docs Acme",
      slug,
      size: "small",
      activity: "servicios",
    });
    tenantId = tenant.id;

    const user = await db.user.create({
      data: {
        name: "Docs Uploader",
        email: `docs@${slug}.test`,
        emailVerified: true,
        platformRole: "platform_superuser",
      },
    });
    userId = user.id;

    const req = await db.tenantRequirement.findFirst({
      where: { tenantId },
    });
    requirementId = req!.id;
  });

  afterAll(async () => {
    await db.document.updateMany({
      where: { tenantId },
      data: { currentVersionId: null },
    });
    await db.documentVersion.deleteMany({
      where: { document: { tenantId } },
    });
    await db.document.deleteMany({ where: { tenantId } });
    await db.tenantRequirement.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("uploads PDF, links requirement, and reads back via storage mock", async () => {
    const body = Buffer.from("%PDF-1.4 mock content");
    const doc = await uploadTenantDocument(
      {
        tenantId,
        title: "Procedimiento de Calidad",
        fate: "create",
        tenantRequirementId: requirementId,
        fileName: "calidad.pdf",
        contentType: "application/pdf",
        body,
        uploadedById: userId,
        isPlatformSuperuser: true,
      },
      { db, storage },
    );

    expect(doc.currentVersion?.versionNumber).toBe(1);
    expect(doc.versions).toHaveLength(1);

    const file = await readDocumentFile(doc.id, { db, storage });
    expect(file?.body.toString()).toContain("%PDF-1.4");
    expect(file?.version.fileName).toBe("calidad.pdf");
  });

  it("protects keep documents unless forced by platform superuser", async () => {
    const body = Buffer.from("%PDF-1.4 keep");
    const doc = await uploadTenantDocument(
      {
        tenantId,
        title: "Manual vigente",
        fate: "keep",
        fileName: "manual.pdf",
        contentType: "application/pdf",
        body,
        uploadedById: userId,
        isPlatformSuperuser: true,
      },
      { db, storage },
    );

    await expect(
      uploadTenantDocument(
        {
          tenantId,
          documentId: doc.id,
          title: "Manual vigente",
          fileName: "manual-v2.pdf",
          contentType: "application/pdf",
          body: Buffer.from("%PDF-1.4 v2"),
          uploadedById: userId,
          isPlatformSuperuser: true,
          forceOverwriteKeep: false,
        },
        { db, storage },
      ),
    ).rejects.toBeInstanceOf(DocumentKeepProtectedError);

    const updated = await uploadTenantDocument(
      {
        tenantId,
        documentId: doc.id,
        title: "Manual vigente",
        fileName: "manual-v2.pdf",
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4 v2"),
        uploadedById: userId,
        isPlatformSuperuser: true,
        forceOverwriteKeep: true,
      },
      { db, storage },
    );

    expect(updated.currentVersion?.versionNumber).toBe(2);
    expect(updated.versions).toHaveLength(2);
  });
});
