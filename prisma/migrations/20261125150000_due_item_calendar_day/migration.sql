-- dueOn / remindOn: día calendario en que vence y desde el que está "por vencer".
-- Una medianoche UTC exacta es una fecha sin hora (conserva su día); cualquier otro instante usa el día de Argentina.
-- Misma regla que dueColumns (src/domain/due/day.ts). "dueAt" es timestamp sin zona guardado en UTC.

-- AlterTable
ALTER TABLE "due_item"
ADD COLUMN "dueOn" DATE,
ADD COLUMN "remindOn" DATE;

UPDATE "due_item"
SET "dueOn" = CASE
  WHEN "dueAt"::time = TIME '00:00:00' THEN "dueAt"::date
  ELSE (("dueAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
END;

UPDATE "due_item"
SET "remindOn" = "dueOn" - GREATEST("leadDays", 0);

ALTER TABLE "due_item"
ALTER COLUMN "dueOn" SET NOT NULL,
ALTER COLUMN "remindOn" SET NOT NULL;

-- Ningún alta ni cambio puede dejar el día calendario desactualizado (Prisma no modela los CHECK).
ALTER TABLE "due_item"
ADD CONSTRAINT "due_item_calendar_check" CHECK (
  "dueOn" = CASE
    WHEN "dueAt"::time = TIME '00:00:00' THEN "dueAt"::date
    ELSE (("dueAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  END
  AND "remindOn" = "dueOn" - GREATEST("leadDays", 0)
);

-- CreateIndex
CREATE INDEX "due_item_tenantId_status_dueOn_idx" ON "due_item"("tenantId", "status", "dueOn");

-- CreateIndex
CREATE INDEX "due_item_status_remindOn_idx" ON "due_item"("status", "remindOn");
