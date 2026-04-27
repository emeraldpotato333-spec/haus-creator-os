import { notFound } from "next/navigation";
import { PageHeading } from "@/components/app/page-heading";
import { RuntimeNotice } from "@/components/app/runtime-notice";
import { CreatorDetailClient } from "@/components/creators/creator-detail-client";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrismaPageNotice, isPrismaSchemaDriftError, logPrismaPageError } from "@/lib/prisma-compat";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CreatorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { creator, templates, notices } = await loadCreatorDetailData(id);

  if (!creator) {
    notFound();
  }

  return (
    <>
      <PageHeading eyebrow="Creator record" title={creator.name} />
      <RuntimeNotice notices={notices} />
      <CreatorDetailClient initialCreator={serialize(creator)} templates={serialize(templates)} />
    </>
  );
}

async function loadCreatorDetailData(id: string) {
  const prisma = getPrisma();
  const templates = await prisma.template.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });

  try {
    const creator = await prisma.creator.findUnique({
      where: { id },
      include: {
        interactions: { orderBy: { happenedAt: "desc" } },
        tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
        briefs: { orderBy: { updatedAt: "desc" } },
        linkedTemplates: { include: { template: true } },
      },
    });

    return { creator, templates, notices: [] as string[] };
  } catch (error) {
    logPrismaPageError("creator-detail.current", error);

    if (isPrismaSchemaDriftError(error)) {
      try {
        const creator = await loadLegacyCreatorDetail(prisma, id);
        return {
          creator,
          templates,
          notices: creator ? ["Creator record loaded in compatibility mode. Run Prisma migrations so the latest creator fields are available."] : [],
        };
      } catch (legacyError) {
        logPrismaPageError("creator-detail.legacy", legacyError);
      }
    }

    return {
      creator: null,
      templates,
      notices: [getPrismaPageNotice("Creator record", error)],
    };
  }
}

async function loadLegacyCreatorDetail(prisma: PrismaClient, id: string) {
  const creator = await prisma.creator.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      handle: true,
      platform: true,
      profileUrl: true,
      email: true,
      location: true,
      niche: true,
      source: true,
      audienceSummary: true,
      whyFit: true,
      notes: true,
      tags: true,
      followers: true,
      engagementRate: true,
      estimatedReach: true,
      contentLiveUrl: true,
      affiliateCode: true,
      conversions: true,
      revenueCents: true,
      stage: true,
      priority: true,
      audienceFit: true,
      contentQuality: true,
      aestheticFit: true,
      authorityTrust: true,
      purchaseIntent: true,
      overallScore: true,
      updatedAt: true,
      stageChangedAt: true,
      interactions: {
        orderBy: { happenedAt: "desc" },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          happenedAt: true,
        },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        select: {
          id: true,
          title: true,
          details: true,
          status: true,
          dueDate: true,
          priority: true,
        },
      },
      briefs: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          body: true,
          status: true,
          dueDate: true,
        },
      },
      linkedTemplates: {
        include: { template: true },
      },
    },
  });

  if (!creator) {
    return null;
  }

  return {
    ...creator,
    profileImageUrl: null,
    nextAction: creator.whyFit || null,
    lastContactedAt: null,
    nextFollowUpAt: null,
    visualFitScore: creator.aestheticFit ?? 0,
    commercialFitScore: creator.audienceFit ?? creator.purchaseIntent ?? 0,
    trustPurchaseIntentScore: creator.authorityTrust ?? creator.purchaseIntent ?? 0,
    overallScoreOverride: null,
  };
}
