-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('SOURCED', 'VETTED', 'INVITED', 'REPLIED', 'QUALIFIED', 'SAMPLE_SENT', 'BRIEF_SENT', 'CONTENT_LIVE', 'EVALUATED', 'EXPANDED', 'AMBASSADOR');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('NOTE', 'EMAIL', 'DM', 'CALL', 'SAMPLE', 'CONTENT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('OUTREACH', 'FOLLOW_UP', 'BRIEF', 'OFFER', 'RIGHTS', 'NURTURE');

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('DRAFT', 'SENT', 'CONTENT_LIVE', 'REVIEWED');

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'Instagram',
    "profileUrl" TEXT,
    "email" TEXT,
    "location" TEXT,
    "niche" TEXT,
    "source" TEXT,
    "audienceSummary" TEXT,
    "whyFit" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "followers" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "estimatedReach" INTEGER,
    "contentLiveUrl" TEXT,
    "affiliateCode" TEXT,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "stage" "PipelineStage" NOT NULL DEFAULT 'SOURCED',
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "audienceFit" INTEGER NOT NULL DEFAULT 0,
    "contentQuality" INTEGER NOT NULL DEFAULT 0,
    "aestheticFit" INTEGER NOT NULL DEFAULT 0,
    "authorityTrust" INTEGER NOT NULL DEFAULT 0,
    "logisticsFit" INTEGER NOT NULL DEFAULT 0,
    "purchaseIntent" INTEGER NOT NULL DEFAULT 0,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "type" "InteractionType" NOT NULL DEFAULT 'NOTE',
    "channel" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "automationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorTemplate" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "BriefStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'app',
    "brandName" TEXT NOT NULL DEFAULT 'HAUS',
    "defaultTheme" TEXT NOT NULL DEFAULT 'system',
    "memoryText" TEXT NOT NULL DEFAULT '',
    "brandVoice" TEXT NOT NULL DEFAULT '',
    "recruitmentCriteria" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Creator_stage_idx" ON "Creator"("stage");

-- CreateIndex
CREATE INDEX "Creator_updatedAt_idx" ON "Creator"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_platform_handle_key" ON "Creator"("platform", "handle");

-- CreateIndex
CREATE INDEX "Interaction_creatorId_idx" ON "Interaction"("creatorId");

-- CreateIndex
CREATE INDEX "Interaction_happenedAt_idx" ON "Interaction"("happenedAt");

-- CreateIndex
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");

-- CreateIndex
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Template_name_key" ON "Template"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorTemplate_creatorId_templateId_key" ON "CreatorTemplate"("creatorId", "templateId");

-- CreateIndex
CREATE INDEX "Brief_creatorId_idx" ON "Brief"("creatorId");

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorTemplate" ADD CONSTRAINT "CreatorTemplate_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorTemplate" ADD CONSTRAINT "CreatorTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
