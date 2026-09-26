CREATE TYPE "WorkflowStatus" AS ENUM ('open', 'in_progress', 'closed');

CREATE TABLE "nonconformity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'open',
    "ownerName" TEXT,
    "source" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nonconformity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nonconformity_tenantId_status_idx" ON "nonconformity"("tenantId", "status");

CREATE TABLE "corrective_action" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nonconformityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'open',
    "ownerName" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corrective_action_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "corrective_action_tenantId_status_idx" ON "corrective_action"("tenantId", "status");
CREATE INDEX "corrective_action_nonconformityId_idx" ON "corrective_action"("nonconformityId");

ALTER TABLE "nonconformity" ADD CONSTRAINT "nonconformity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "nonconformity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
