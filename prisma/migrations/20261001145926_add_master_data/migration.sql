-- CreateEnum
CREATE TYPE "SiteKind" AS ENUM ('office', 'base', 'worksite', 'field', 'camp', 'plant');

-- CreateEnum
CREATE TYPE "PersonEmployer" AS ENUM ('own', 'contractor');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "site" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SiteKind" NOT NULL DEFAULT 'office',
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_position" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentId" TEXT,
    "userId" TEXT,
    "employer" "PersonEmployer" NOT NULL DEFAULT 'own',
    "contractorName" TEXT,
    "siteId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "hiredAt" TIMESTAMP(3),
    "status" "PersonStatus" NOT NULL DEFAULT 'active',
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_site" (
    "personId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "person_site_pkey" PRIMARY KEY ("personId","siteId")
);

-- CreateTable
CREATE TABLE "person_job_task" (
    "personId" TEXT NOT NULL,
    "jobTaskId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "person_job_task_pkey" PRIMARY KEY ("personId","jobTaskId")
);

-- CreateTable
CREATE TABLE "master_data_audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_data_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_tenantId_active_idx" ON "site"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "site_tenantId_name_key" ON "site"("tenantId", "name");

-- CreateIndex
CREATE INDEX "job_position_tenantId_active_idx" ON "job_position"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "job_position_tenantId_name_key" ON "job_position"("tenantId", "name");

-- CreateIndex
CREATE INDEX "job_task_tenantId_active_idx" ON "job_task"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "job_task_tenantId_name_key" ON "job_task"("tenantId", "name");

-- CreateIndex
CREATE INDEX "person_tenantId_status_idx" ON "person"("tenantId", "status");

-- CreateIndex
CREATE INDEX "person_siteId_idx" ON "person"("siteId");

-- CreateIndex
CREATE INDEX "person_positionId_idx" ON "person"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "person_tenantId_employeeCode_key" ON "person"("tenantId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "person_tenantId_userId_key" ON "person"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "person_site_tenantId_siteId_idx" ON "person_site"("tenantId", "siteId");

-- CreateIndex
CREATE INDEX "person_job_task_tenantId_jobTaskId_idx" ON "person_job_task"("tenantId", "jobTaskId");

-- CreateIndex
CREATE INDEX "master_data_audit_tenantId_createdAt_idx" ON "master_data_audit"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "master_data_audit_tenantId_entityType_entityId_idx" ON "master_data_audit"("tenantId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_position" ADD CONSTRAINT "job_position_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_task" ADD CONSTRAINT "job_task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "job_position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_site" ADD CONSTRAINT "person_site_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_site" ADD CONSTRAINT "person_site_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_job_task" ADD CONSTRAINT "person_job_task_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_job_task" ADD CONSTRAINT "person_job_task_jobTaskId_fkey" FOREIGN KEY ("jobTaskId") REFERENCES "job_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data_audit" ADD CONSTRAINT "master_data_audit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
