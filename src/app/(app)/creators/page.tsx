import { PageHeading } from "@/components/app/page-heading";
import { RuntimeNotice } from "@/components/app/runtime-notice";
import { CreatorsClient } from "@/components/creators/creators-client";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrismaPageNotice, isPrismaSchemaDriftError, logPrismaPageError } from "@/lib/prisma-compat";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const { creators, notices } = await loadCreatorsPageData();

  return (
    <>
      <PageHeading eyebrow="Recruitment" title="Creators" />
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
        tier: true,
        tags: true,
        nextAction: true,
        overallScore: true,
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
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
          notices: ["Creators loaded in compatibility mode. Run Prisma migrations so the latest creator fields are available."],
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
      tags: true,
      whyFit: true,
      overallScore: true,
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  return creators.map((creator) => ({
    ...creator,
    profileImageUrl: null,
    projectType: null,
    tier: null,
    nextAction: creator.whyFit || null,
  }));
}
