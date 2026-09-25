import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createDocumentForTenant,
  getDocumentForTenant,
  listDocumentsForTenant,
} from "@/lib/tenant-queries";
import { TenantAccessError } from "@/domain/tenancy/access";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("tenant document isolation (integration)", () => {
  const db = new PrismaClient();
  let tenantAId = "";
  let tenantBId = "";
  let docAId = "";

  beforeAll(async () => {
    await db.document.deleteMany();
    await db.membership.deleteMany();
    await db.tenant.deleteMany({
      where: { slug: { in: ["acme-a", "acme-b"] } },
    });

    const tenantA = await db.tenant.create({
      data: { name: "Acme A", slug: "acme-a", size: "small", activity: "manufactura" },
    });
    const tenantB = await db.tenant.create({
      data: { name: "Acme B", slug: "acme-b", size: "medium", activity: "servicios" },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const docA = await createDocumentForTenant(
      db,
      { tenantId: tenantAId, isPlatformSuperuser: false },
      { title: "Procedimiento A" },
    );
    docAId = docA.id;

    await createDocumentForTenant(
      db,
      { tenantId: tenantBId, isPlatformSuperuser: false },
      { title: "Procedimiento B" },
    );
  });

  afterAll(async () => {
    await db.document.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await db.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } },
    });
    await db.$disconnect();
  });

  it("lista solo documentos del tenant activo", async () => {
    const docs = await listDocumentsForTenant(db, {
      tenantId: tenantAId,
      isPlatformSuperuser: false,
    });

    expect(docs).toHaveLength(1);
    expect(docs[0]?.title).toBe("Procedimiento A");
  });

  it("impide leer un documento de otro tenant", async () => {
    await expect(
      getDocumentForTenant(
        db,
        { tenantId: tenantBId, isPlatformSuperuser: false },
        docAId,
      ),
    ).rejects.toBeInstanceOf(TenantAccessError);
  });

  it("impide listar sin tenant activo (usuario no superusuario)", async () => {
    await expect(
      listDocumentsForTenant(db, {
        tenantId: null,
        isPlatformSuperuser: false,
      }),
    ).rejects.toBeInstanceOf(TenantAccessError);
  });
});
