-- CreateTable
CREATE TABLE "tenant_requirement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'template',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_requirement_tenantId_idx" ON "tenant_requirement"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_requirement_tenantId_requirementId_key" ON "tenant_requirement"("tenantId", "requirementId");

-- AddForeignKey
ALTER TABLE "tenant_requirement" ADD CONSTRAINT "tenant_requirement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_requirement" ADD CONSTRAINT "tenant_requirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "iso_requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
