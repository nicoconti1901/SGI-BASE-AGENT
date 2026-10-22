-- CreateEnum
CREATE TYPE "CourseCategory" AS ENUM ('induction', 'awareness', 'safety', 'environment', 'quality', 'driving', 'other');

-- CreateEnum
CREATE TYPE "CourseModality" AS ENUM ('in_person', 'online', 'on_the_job', 'external');

-- CreateEnum
CREATE TYPE "TrainingTargetKind" AS ENUM ('position', 'task', 'all');

-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('planned', 'held', 'cancelled');

-- CreateEnum
CREATE TYPE "TrainingLevel" AS ENUM ('senior', 'middle', 'operational');

-- CreateEnum
CREATE TYPE "InstructorKind" AS ENUM ('internal', 'external');

-- CreateEnum
CREATE TYPE "TrainingResult" AS ENUM ('passed', 'failed');

-- CreateEnum
CREATE TYPE "TrainingValiditySource" AS ENUM ('computed', 'certificate');

-- CreateEnum
CREATE TYPE "TrainingRecordSource" AS ENUM ('session', 'individual', 'import');

-- CreateEnum
CREATE TYPE "TrainingEffectivenessMethod" AS ENUM ('observation', 'practical_test', 'written_test', 'indicator', 'supervisor_review');

-- CreateTable
CREATE TABLE "training_course" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" "CourseCategory" NOT NULL DEFAULT 'other',
    "standards" "IsoStandard"[],
    "modality" "CourseModality" NOT NULL DEFAULT 'in_person',
    "defaultHours" DECIMAL(5,2),
    "validityMonths" INTEGER,
    "reminderDays" INTEGER NOT NULL DEFAULT 30,
    "requiresEffectiveness" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessDays" INTEGER NOT NULL DEFAULT 90,
    "legalBasis" TEXT,
    "defaultProvider" TEXT,
    "suggestedKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_requirement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "targetKind" "TrainingTargetKind" NOT NULL,
    "positionId" TEXT,
    "jobTaskId" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "graceDays" INTEGER NOT NULL DEFAULT 30,
    "effectiveFrom" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_session" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'held',
    "heldAt" DATE NOT NULL,
    "siteId" TEXT,
    "level" "TrainingLevel",
    "instructorKind" "InstructorKind" NOT NULL DEFAULT 'internal',
    "instructorName" TEXT NOT NULL DEFAULT '',
    "providerName" TEXT,
    "hours" DECIMAL(5,2),
    "evaluatorUserId" TEXT,
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_record" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "completedAt" DATE NOT NULL,
    "result" "TrainingResult" NOT NULL,
    "score" INTEGER,
    "validUntil" DATE,
    "validUntilSource" "TrainingValiditySource" NOT NULL DEFAULT 'computed',
    "source" "TrainingRecordSource" NOT NULL DEFAULT 'individual',
    "certificateNumber" TEXT,
    "providerName" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_effectiveness" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "dueAt" DATE NOT NULL,
    "evaluatorUserId" TEXT,
    "status" "EffectivenessStatus" NOT NULL DEFAULT 'pending',
    "method" "TrainingEffectivenessMethod",
    "note" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "actionId" TEXT,
    "rescheduledTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_effectiveness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT,
    "recordId" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "matrixReviewedAt" TIMESTAMP(3),
    "matrixReviewedByUserId" TEXT,
    "matrixReviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "summary" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_course_tenantId_active_idx" ON "training_course"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "training_course_tenantId_name_key" ON "training_course"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "training_course_tenantId_suggestedKey_key" ON "training_course"("tenantId", "suggestedKey");

-- CreateIndex
CREATE INDEX "training_requirement_tenantId_targetKind_idx" ON "training_requirement"("tenantId", "targetKind");

-- CreateIndex
CREATE INDEX "training_requirement_tenantId_positionId_idx" ON "training_requirement"("tenantId", "positionId");

-- CreateIndex
CREATE INDEX "training_requirement_tenantId_jobTaskId_idx" ON "training_requirement"("tenantId", "jobTaskId");

-- CreateIndex
CREATE INDEX "training_requirement_tenantId_courseId_idx" ON "training_requirement"("tenantId", "courseId");

-- CreateIndex
CREATE INDEX "training_session_tenantId_heldAt_idx" ON "training_session"("tenantId", "heldAt");

-- CreateIndex
CREATE INDEX "training_session_tenantId_courseId_idx" ON "training_session"("tenantId", "courseId");

-- CreateIndex
CREATE INDEX "training_session_tenantId_siteId_heldAt_idx" ON "training_session"("tenantId", "siteId", "heldAt");

-- CreateIndex
CREATE INDEX "training_record_tenantId_personId_courseId_completedAt_idx" ON "training_record"("tenantId", "personId", "courseId", "completedAt");

-- CreateIndex
CREATE INDEX "training_record_tenantId_sessionId_idx" ON "training_record"("tenantId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "training_effectiveness_recordId_key" ON "training_effectiveness"("recordId");

-- CreateIndex
CREATE INDEX "training_effectiveness_tenantId_status_dueAt_idx" ON "training_effectiveness"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "training_effectiveness_actionId_idx" ON "training_effectiveness"("actionId");

-- CreateIndex
CREATE INDEX "training_attachment_tenantId_recordId_idx" ON "training_attachment"("tenantId", "recordId");

-- CreateIndex
CREATE INDEX "training_attachment_tenantId_sessionId_idx" ON "training_attachment"("tenantId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "training_settings_tenantId_key" ON "training_settings"("tenantId");

-- CreateIndex
CREATE INDEX "training_audit_tenantId_createdAt_idx" ON "training_audit"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "training_audit_tenantId_entityType_entityId_idx" ON "training_audit"("tenantId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "training_course" ADD CONSTRAINT "training_course_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_requirement" ADD CONSTRAINT "training_requirement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_requirement" ADD CONSTRAINT "training_requirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "training_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_requirement" ADD CONSTRAINT "training_requirement_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "job_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_requirement" ADD CONSTRAINT "training_requirement_jobTaskId_fkey" FOREIGN KEY ("jobTaskId") REFERENCES "job_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "training_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_record" ADD CONSTRAINT "training_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_record" ADD CONSTRAINT "training_record_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_record" ADD CONSTRAINT "training_record_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "training_course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_record" ADD CONSTRAINT "training_record_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_effectiveness" ADD CONSTRAINT "training_effectiveness_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_effectiveness" ADD CONSTRAINT "training_effectiveness_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "training_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_effectiveness" ADD CONSTRAINT "training_effectiveness_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attachment" ADD CONSTRAINT "training_attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attachment" ADD CONSTRAINT "training_attachment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attachment" ADD CONSTRAINT "training_attachment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "training_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_settings" ADD CONSTRAINT "training_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_audit" ADD CONSTRAINT "training_audit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Invariantes que Prisma no expresa (SPEC-training, "Domain model") ─────────

-- Curso: el nombre no se repite sin importar mayúsculas (los selectores muestran el nombre) y los rangos del SPEC.
CREATE UNIQUE INDEX "training_course_tenantId_lower_name_key" ON "training_course"("tenantId", lower("name"));
ALTER TABLE "training_course" ADD CONSTRAINT "training_course_name_check" CHECK (length(btrim("name")) > 0);
ALTER TABLE "training_course" ADD CONSTRAINT "training_course_validity_check" CHECK ("validityMonths" IS NULL OR "validityMonths" BETWEEN 1 AND 120);
ALTER TABLE "training_course" ADD CONSTRAINT "training_course_reminder_check" CHECK ("reminderDays" BETWEEN 15 AND 90);
ALTER TABLE "training_course" ADD CONSTRAINT "training_course_effectiveness_days_check" CHECK ("effectivenessDays" BETWEEN 30 AND 180);
ALTER TABLE "training_course" ADD CONSTRAINT "training_course_hours_check" CHECK ("defaultHours" IS NULL OR "defaultHours" > 0);

-- Requisito: exactamente la FK que corresponde al destino, plazo de gracia acotado y un solo requisito por (curso, destino).
ALTER TABLE "training_requirement" ADD CONSTRAINT "training_requirement_target_check" CHECK (
  ("targetKind" = 'position' AND "positionId" IS NOT NULL AND "jobTaskId" IS NULL)
  OR ("targetKind" = 'task' AND "jobTaskId" IS NOT NULL AND "positionId" IS NULL)
  OR ("targetKind" = 'all' AND "positionId" IS NULL AND "jobTaskId" IS NULL)
);
ALTER TABLE "training_requirement" ADD CONSTRAINT "training_requirement_grace_check" CHECK ("graceDays" BETWEEN 0 AND 365);
CREATE UNIQUE INDEX "training_requirement_position_key" ON "training_requirement"("tenantId", "courseId", "positionId") WHERE "targetKind" = 'position';
CREATE UNIQUE INDEX "training_requirement_task_key" ON "training_requirement"("tenantId", "courseId", "jobTaskId") WHERE "targetKind" = 'task';
CREATE UNIQUE INDEX "training_requirement_all_key" ON "training_requirement"("tenantId", "courseId") WHERE "targetKind" = 'all';

-- Sesión: una anulación siempre lleva motivo.
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_void_check" CHECK (("voidedAt" IS NULL) = ("voidReason" IS NULL));
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_hours_check" CHECK ("hours" IS NULL OR "hours" > 0);

-- Registro: nota 0–100, vencimiento coherente, anulación con motivo e idempotencia de la carga.
ALTER TABLE "training_record" ADD CONSTRAINT "training_record_score_check" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100);
ALTER TABLE "training_record" ADD CONSTRAINT "training_record_valid_until_check" CHECK ("validUntil" IS NULL OR ("result" = 'passed' AND "validUntil" >= "completedAt"));
ALTER TABLE "training_record" ADD CONSTRAINT "training_record_void_check" CHECK (("voidedAt" IS NULL) = ("voidReason" IS NULL));
CREATE UNIQUE INDEX "training_record_session_person_key" ON "training_record"("sessionId", "personId") WHERE "sessionId" IS NOT NULL AND "voidedAt" IS NULL;
CREATE UNIQUE INDEX "training_record_person_course_day_key" ON "training_record"("tenantId", "personId", "courseId", "completedAt", "result") WHERE "voidedAt" IS NULL;

-- Índices parciales de lectura: el cálculo y los vencimientos solo miran aprobados no anulados.
CREATE INDEX "training_record_best_idx" ON "training_record"("tenantId", "personId", "courseId", "validUntil" DESC NULLS FIRST, "completedAt" DESC) WHERE "result" = 'passed' AND "voidedAt" IS NULL;
CREATE INDEX "training_record_expiry_idx" ON "training_record"("tenantId", "courseId", "validUntil") WHERE "result" = 'passed' AND "voidedAt" IS NULL;

-- Adjunto: de una sesión o de un registro, nunca de ambos ni de ninguno.
ALTER TABLE "training_attachment" ADD CONSTRAINT "training_attachment_owner_check" CHECK (("sessionId" IS NULL) <> ("recordId" IS NULL));
ALTER TABLE "training_attachment" ADD CONSTRAINT "training_attachment_size_check" CHECK ("sizeBytes" >= 0);
