-- remindAt = dueAt − leadDays días: desde cuándo el vencimiento está "por vencer".
-- Se agrega nullable, se completa para los existentes y recién después pasa a NOT NULL.
ALTER TABLE "due_item" ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "personId" TEXT,
ADD COLUMN "remindAt" TIMESTAMP(3),
ADD COLUMN "siteId" TEXT;

UPDATE "due_item"
SET "remindAt" = "dueAt" - make_interval(days => GREATEST("leadDays", 0));

ALTER TABLE "due_item" ALTER COLUMN "remindAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "due_item_tenantId_status_remindAt_idx" ON "due_item"("tenantId", "status", "remindAt");

-- CreateIndex
CREATE INDEX "due_item_status_remindAt_idx" ON "due_item"("status", "remindAt");

-- CreateIndex
CREATE INDEX "due_item_ownerUserId_idx" ON "due_item"("ownerUserId");

-- AddForeignKey
ALTER TABLE "due_item" ADD CONSTRAINT "due_item_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_item" ADD CONSTRAINT "due_item_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
