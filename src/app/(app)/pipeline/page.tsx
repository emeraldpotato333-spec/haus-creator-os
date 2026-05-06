import { PageHeading } from "@/components/app/page-heading";
import { RuntimeNotice } from "@/components/app/runtime-notice";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrismaPageNotice, isPrismaSchemaDriftError, logPrismaPageError } from "@/lib/prisma-compat";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { creators, notices } = await loadPipelineData();

  return (
    <>
      <PageHeading eyebrow="Overview only" title="Pipeline">
        <div className="text-sm text-muted-foreground">Use this for overview. Do daily work from the Dashboard.</div>
      </PageHeading>
      <RuntimeNotice notices={notices} />
      <PipelineBoard creators={serialize(creators)} />
    </>
  );
}

async function loadPipelineData() {
  const prisma = getPrisma();

  try {
    const creators = await prisma.creator.findMany({
      orderBy: [{ stageChangedAt: "desc" }],
      select: {
        id: true,
        name: true,
        handle: true,
        platform: true,
        stage: true,
        overallScore: true,
        profileImageUrl: true,
        niche: true,
        nextAction: true,
        projectType: true,
        collabAngle: true,
        tier: true,
        tags: true,
        priority: true,
      },
    });

    return { creators, notices: [] as string[] };
  } catch (error) {
    logPrismaPageError("pipeline.current", error);

    if (isPrismaSchemaDriftError(error)) {
      try {
        const creators = await loadLegacyPipelineCreators(prisma);
        return {
          creators,
          notices: ["Pipeline loaded in compatibility mode. Run Prisma migrations so the latest creator fields are available."],
        };
      } catch (legacyError) {
        logPrismaPageError("pipeline.legacy", legacyError);
      }
    }

    return {
      creators: [],
      notices: [getPrismaPageNotice("Pipeline", error)],
    };
  }
}

async function loadLegacyPipelineCreators(prisma: PrismaClient) {
  const creators = await prisma.creator.findMany({
    orderBy: [{ stageChangedAt: "desc" }],
    select: {
      id: true,
      name: true,
      handle: true,
      platform: true,
      stage: true,
      overallScore: true,
      niche: true,
      whyFit: true,
      tags: true,
      priority: true,
    },
  });

  return creators.map((creator) => ({
    ...creator,
    profileImageUrl: null,
    nextAction: creator.whyFit || null,
    projectType: null,
    collabAngle: creator.whyFit || null,
    tier: null,
  }));
}
