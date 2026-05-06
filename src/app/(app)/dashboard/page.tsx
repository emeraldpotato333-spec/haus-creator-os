import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { LoadDemoButton } from "@/components/app/load-demo-button";
import { PageHeading } from "@/components/app/page-heading";
import { CommandCenterClient } from "@/components/dashboard/command-center-client";
import { Button } from "@/components/ui/button";
import type { PrismaClient } from "@/generated/prisma/client";
import { getLegacyExactStepFromStage, isExactStepValue } from "@/lib/creator-command-center";
import { isPrismaSchemaDriftError } from "@/lib/prisma-compat";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { creators, notices } = await loadDashboardData();

  return (
    <>
      <PageHeading eyebrow="Today’s creator moves" title="Creator Command Center" />
      <div className="grid gap-4">
        {notices.length ? <DashboardNotice notices={notices} /> : null}
        {creators.length === 0 ? <DashboardEmptyState /> : <CommandCenterClient creators={serialize(creators)} />}
      </div>
    </>
  );
}

async function loadDashboardData() {
  try {
    const prisma = getPrisma();
    const creators = await prisma.creator.findMany({
      orderBy: [{ isTodayFocus: "desc" }, { todayFocusRank: "asc" }, { overallScore: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        handle: true,
        platform: true,
        profileImageUrl: true,
        stage: true,
        priority: true,
        overallScore: true,
        whyFit: true,
        projectType: true,
        collabAngle: true,
        tier: true,
        exactStep: true,
        nextAction: true,
        bossApprovalNeeded: true,
        bossApprovalStatus: true,
        sampleStatus: true,
        briefStatus: true,
        usageRightsStatus: true,
        adPotential: true,
        isTodayFocus: true,
        todayFocusRank: true,
      },
    });

    return {
      creators: creators.map((creator) => ({
        ...creator,
        collabAngle: creator.collabAngle ?? creator.whyFit ?? null,
        exactStep: isExactStepValue(creator.exactStep)
          ? creator.exactStep
          : getLegacyExactStepFromStage(creator.stage, creator.nextAction ?? creator.whyFit ?? null, creator.tier),
      })),
      notices: [] as string[],
    };
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      try {
        const prisma = getPrisma();
        const creators = await loadLegacyDashboardCreators(prisma);
        return {
          creators,
          notices: ["Dashboard is using the legacy preview schema. Run the additive Creator Command Center migrations for tiers, exact steps, approvals, and asset statuses."],
        };
      } catch (legacyError) {
        console.error("[HAUS Creator OS dashboard]", {
          error: legacyError instanceof Error ? legacyError.message : String(legacyError),
        });
      }
    }

    console.error("[HAUS Creator OS dashboard]", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      creators: [],
      notices: [getDashboardNotice(error)],
    };
  }
}

async function loadLegacyDashboardCreators(prisma: PrismaClient) {
  const creators = await prisma.creator.findMany({
    orderBy: [{ overallScore: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      handle: true,
      platform: true,
      profileImageUrl: true,
      stage: true,
      priority: true,
      overallScore: true,
      whyFit: true,
      nextAction: true,
    },
  });

  return creators.map((creator) => ({
    ...creator,
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
  }));
}

function getDashboardNotice(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    if (error.message.includes("DATABASE_URL")) {
      return "Dashboard could not connect to the database. Set DATABASE_URL in Vercel, then redeploy.";
    }
  }

  return "Dashboard data is temporarily unavailable. The page is loading in a calm fallback state.";
}

function DashboardNotice({ notices }: { notices: string[] }) {
  return (
    <div className="rounded-md border border-amber-300/60 bg-amber-100/80 p-4 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="grid gap-1">
          {Array.from(new Set(notices)).map((notice) => (
            <div key={notice}>{notice}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed p-14 text-center">
      <div className="text-lg font-medium">Add one creator. Do not build the whole system first.</div>
      <p className="mt-2 text-sm text-muted-foreground">
        The flywheel is built from reps, not perfect planning.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button render={<Link href="/creators" />}>Add first creator</Button>
        <LoadDemoButton />
      </div>
    </div>
  );
}
