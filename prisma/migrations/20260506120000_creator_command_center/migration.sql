-- CreateEnum
CREATE TYPE "CreatorTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3', 'TIER_4');

-- CreateEnum
CREATE TYPE "BossApprovalStatus" AS ENUM ('NEEDS_APPROVAL', 'WAITING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED');

-- CreateEnum
CREATE TYPE "CreatorBriefStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "UsageRightsStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "AdPotential" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "Creator"
ADD COLUMN "projectType" TEXT,
ADD COLUMN "projectSize" TEXT,
ADD COLUMN "timeline" TEXT,
ADD COLUMN "tileInterest" TEXT,
ADD COLUMN "collabAngle" TEXT,
ADD COLUMN "proposedOffer" TEXT,
ADD COLUMN "tier" "CreatorTier",
ADD COLUMN "bossApprovalNeeded" BOOLEAN,
ADD COLUMN "bossApprovalStatus" "BossApprovalStatus",
ADD COLUMN "sampleStatus" "SampleStatus",
ADD COLUMN "briefStatus" "CreatorBriefStatus",
ADD COLUMN "contentDueDate" TIMESTAMP(3),
ADD COLUMN "usageRightsStatus" "UsageRightsStatus",
ADD COLUMN "adPotential" "AdPotential",
ADD COLUMN "isTodayFocus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "todayFocusRank" INTEGER;

CREATE INDEX "Creator_tier_idx" ON "Creator"("tier");
CREATE INDEX "Creator_isTodayFocus_todayFocusRank_idx" ON "Creator"("isTodayFocus", "todayFocusRank");
