-- CreateEnum
CREATE TYPE "DueItemStatus" AS ENUM ('open', 'closed', 'cancelled');
CREATE TYPE "OfferKind" AS ENUM ('native', 'integration');
CREATE TYPE "AutomationRunStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "automation_offer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "OfferKind" NOT NULL DEFAULT 'native',
    "enabledGlobal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_offer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "automation_offer_code_key" ON "automation_offer"("code");

CREATE TABLE "tenant_offer_activation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_offer_activation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_offer_activation_tenantId_offerId_key" ON "tenant_offer_activation"("tenantId", "offerId");
CREATE INDEX "tenant_offer_activation_tenantId_active_idx" ON "tenant_offer_activation"("tenantId", "active");

CREATE TABLE "due_item" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "leadDays" INTEGER NOT NULL DEFAULT 7,
    "status" "DueItemStatus" NOT NULL DEFAULT 'open',
    "lastRemindedAt" TIMESTAMP(3),
    "lastReminderKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "due_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "due_item_tenantId_status_dueAt_idx" ON "due_item"("tenantId", "status", "dueAt");
CREATE INDEX "due_item_tenantId_entityType_entityId_idx" ON "due_item"("tenantId", "entityType", "entityId");

CREATE TABLE "in_app_notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dueItemId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "in_app_notification_tenantId_createdAt_idx" ON "in_app_notification"("tenantId", "createdAt");
CREATE INDEX "in_app_notification_userId_readAt_idx" ON "in_app_notification"("userId", "readAt");

CREATE TABLE "automation_run" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "offerCode" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'running',
    "summary" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "automation_run_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automation_run_offerCode_startedAt_idx" ON "automation_run"("offerCode", "startedAt");
CREATE INDEX "automation_run_tenantId_startedAt_idx" ON "automation_run"("tenantId", "startedAt");

ALTER TABLE "tenant_offer_activation" ADD CONSTRAINT "tenant_offer_activation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_offer_activation" ADD CONSTRAINT "tenant_offer_activation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "automation_offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "due_item" ADD CONSTRAINT "due_item_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "in_app_notification" ADD CONSTRAINT "in_app_notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "in_app_notification" ADD CONSTRAINT "in_app_notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "in_app_notification" ADD CONSTRAINT "in_app_notification_dueItemId_fkey" FOREIGN KEY ("dueItemId") REFERENCES "due_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
