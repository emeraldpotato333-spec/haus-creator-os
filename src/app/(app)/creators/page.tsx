import { PageHeading } from "@/components/app/page-heading";
import { RuntimeNotice } from "@/components/app/runtime-notice";
import { CreatorsClient } from "@/components/creators/creators-client";
import type { PrismaClient } from "@/generated/prisma/client";
import { getLegacyExactStepFromStage } from "@/lib/creator-command-center";
import { getPrismaPageNotice, isPrismaSchemaDriftError, logPrismaPageError } from "@/lib/prisma-compat";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const { creators, notices } = await loadCreatorsPageData();

  return (
    <>
      <PageHeading eyebrow="Working worksheet" title="Lead Tracker" />
      <RuntimeNotice notices={notices} />
      <CreatorsClient creators={serialize(creators)} />
    </>
  );
}

async function loadCreatorsPageData() {
  const prisma = getPrisma();

  try {
    const creators = await prisma.creator.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        handle: true,
        platform: true,
        profileImageUrl: true,
        niche: true,
        stage: true,
        priority: true,
        projectType: true,
        collabAngle: true,
        tier: true,
        exactStep: true,
        bossApprovalNeeded: true,
        bossApprovalStatus: true,
        sampleStatus: true,
        briefStatus: true,
        usageRightsStatus: true,
        adPotential: true,
        isTodayFocus: true,
        todayFocusRank: true,
        tags: true,
        nextAction: true,
        overallScore: true,
      },
    });

    return { creators, notices: [] as string[] };
  } catch (error) {
    logPrismaPageError("creators.current", error);

    if (isPrismaSchemaDriftError(error)) {
      try {
        const creators = await loadLegacyCreators(prisma);
        return {
          creators,
          notices: ["Lead Tracker is using the legacy preview schema. Run the additive Creator Command Center migrations for exact steps, tiers, approvals, and asset statuses."],
        };
      } catch (legacyError) {
        logPrismaPageError("creators.legacy", legacyError);
      }
    }

    return {
      creators: [],
      notices: [getPrismaPageNotice("Creators", error)],
    };
  }
}

async function loadLegacyCreators(prisma: PrismaClient) {
  const creators = await prisma.creator.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      handle: true,
      platform: true,
      niche: true,
      stage: true,
      priority: true,
      whyFit: true,
      overallScore: true,
      tags: true,
      nextAction: true,
    },
  });

  return creators.map((creator) => ({
    ...creator,
    profileImageUrl: null,
    projectType: null,
    collabAngle: creator.whyFit ?? null,
    tier: null,
    exactStep: getLegacyExactStepFromStage(creator.stage, creator.nextAction ?? creator.whyFit ?? null, null),
    bossApprovalNeeded: null,
    bossApprovalStatus: null,
    sampleStatus: null,
    briefStatus: null,
    usageRightsStatus: null,
    adPotential: null,
    isTodayFocus: false,
    todayFocusRank: null,
    nextAction: creator.nextAction ?? creator.whyFit ?? null,
  }));
}
