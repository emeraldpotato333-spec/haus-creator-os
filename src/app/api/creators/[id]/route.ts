import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import {
  getLegacyExactStepFromStage,
  getSuggestedExactStepForTier,
  getSuggestedNextAction,
  getWorkflowPatchForExactStep,
  isExactStepValue,
  type ExactStepValue,
} from "@/lib/creator-command-center";
import { SCORE_FIELDS, calculateOverallScore } from "@/lib/domain";
import { applyStageAutomation } from "@/lib/automation";
import { isPrismaSchemaDriftError } from "@/lib/prisma-compat";
import { getPrisma } from "@/lib/prisma";
import { creatorUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CreatorUpdatePayload = z.infer<typeof creatorUpdateSchema>;

type ExistingCreatorContext = {
  id: string;
  stage: "SOURCED" | "VETTED" | "INVITED" | "REPLIED" | "QUALIFIED" | "SAMPLE_SENT" | "BRIEF_SENT" | "CONTENT_LIVE" | "EVALUATED" | "EXPANDED" | "AMBASSADOR";
  nextAction: string | null;
  tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  exactStep: ExactStepValue | null;
  visualFitScore: number;
  commercialFitScore: number;
  contentQuality: number;
  trustPurchaseIntentScore: number;
  overallScoreOverride: number | null;
  compatibilityMode: boolean;
};

const legacySafeUpdateKeys = new Set([
  "name",
  "handle",
  "platform",
  "profileUrl",
  "profileImageUrl",
  "email",
  "location",
  "niche",
  "source",
  "audienceSummary",
  "whyFit",
  "nextAction",
  "notes",
  "tags",
  "followers",
  "engagementRate",
  "estimatedReach",
  "contentLiveUrl",
  "affiliateCode",
  "conversions",
  "revenueCents",
  "stage",
  "lastContactedAt",
  "nextFollowUpAt",
  "priority",
  "visualFitScore",
  "commercialFitScore",
  "contentQuality",
  "trustPurchaseIntentScore",
  "overallScoreOverride",
]);

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();

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

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    return NextResponse.json(creator);
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }

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
        nextAction: true,
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
        visualFitScore: true,
        commercialFitScore: true,
        contentQuality: true,
        trustPurchaseIntentScore: true,
        overallScoreOverride: true,
        overallScore: true,
        interactions: { orderBy: { happenedAt: "desc" } },
        tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
        briefs: { orderBy: { updatedAt: "desc" } },
        linkedTemplates: { include: { template: true } },
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...creator,
      tier: null,
      exactStep: getLegacyExactStepFromStage(creator.stage, creator.nextAction, null),
      projectType: null,
      collabAngle: creator.whyFit ?? null,
      bossApprovalNeeded: null,
      bossApprovalStatus: null,
      sampleStatus: null,
      briefStatus: null,
      usageRightsStatus: null,
      adPotential: null,
      isTodayFocus: false,
      todayFocusRank: null,
      profileImageUrl: null,
      schemaWarning: "Production is using the legacy schema. Run the additive command-center migrations for full workflow fields.",
    });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logCreatorRouteError({
      route: "creators.update",
      creatorId: id,
      payloadKeys: [],
      error,
    });

    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const payloadKeys = payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload) : [];
  const parsedResult = creatorUpdateSchema.safeParse(payload);

  if (!parsedResult.success) {
    const firstIssue = parsedResult.error.issues[0];
    const field = firstIssue?.path.join(".") || "payload";
    const message = `Invalid ${field}: ${firstIssue?.message || "check the submitted value"}`;

    return NextResponse.json(
      {
        error: message,
        details: parsedResult.error.issues.map((issue) => ({
          field: issue.path.join(".") || "payload",
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const parsed = stripUndefined(parsedResult.data) as CreatorUpdatePayload;
  const existing = await readExistingCreatorContext(prisma, id);

  if (!existing) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const scoreValues = Object.fromEntries(
    SCORE_FIELDS.map((field) => [field.key, parsed[field.key] ?? existing[field.key]]),
  ) as Record<(typeof SCORE_FIELDS)[number]["key"], number>;

  const workflowPatch = buildWorkflowPatch(parsed, existing);
  const nextStage = workflowPatch.stage ?? parsed.stage ?? existing.stage;
  const stageChanged = nextStage !== existing.stage;

  try {
    const fullUpdate = {
      ...parsed,
      ...workflowPatch,
      overallScore: calculateOverallScore(scoreValues, parsed.overallScoreOverride ?? existing.overallScoreOverride),
      ...(stageChanged ? { stageChangedAt: new Date() } : {}),
    };

    const updateData = existing.compatibilityMode
      ? buildLegacyCompatibleUpdate(fullUpdate)
      : fullUpdate;

    if (!Object.keys(updateData).length) {
      return NextResponse.json(
        {
          error: "This change needs the additive Prisma migrations before it can be saved in preview/production.",
        },
        { status: 409 },
      );
    }

    const creator = await prisma.creator.update({
      where: { id },
      data: updateData,
    });

    let automationWarning: string | undefined;

    if (stageChanged) {
      try {
        await applyStageAutomation(prisma, id, nextStage);
        await prisma.interaction.create({
          data: {
            creatorId: id,
            type: "INTERNAL",
            title: "Stage changed",
            body: `${existing.stage} -> ${nextStage}`,
          },
        });
      } catch (error) {
        automationWarning = "Saved, but stage follow-up automation failed.";
        logCreatorRouteError({
          route: "creators.update.stageAutomation",
          creatorId: id,
          payloadKeys,
          error,
        });
      }
    }

    return NextResponse.json({
      ...creator,
      exactStep: existing.compatibilityMode ? existing.exactStep : workflowPatch.exactStep ?? parsed.exactStep ?? existing.exactStep,
      automationWarning,
      schemaWarning: existing.compatibilityMode
        ? "Preview DB is missing additive workflow fields. Supported legacy fields were saved; run Prisma migrations for tier/exact-step/status persistence."
        : undefined,
    });
  } catch (error) {
    const message = getCreatorUpdateErrorMessage(error);

    logCreatorRouteError({
      route: "creators.update",
      creatorId: id,
      payloadKeys,
      error,
    });

    return NextResponse.json({ error: message }, { status: getStatusForError(error) });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const creator = await tx.creator.findUnique({ where: { id }, select: { id: true } });

      if (!creator) {
        return false;
      }

      await tx.interaction.updateMany({
        where: { creatorId: id },
        data: { creatorId: null },
      });

      await tx.brief.updateMany({
        where: { creatorId: id },
        data: { creatorId: null },
      });

      await tx.task.deleteMany({
        where: { creatorId: id },
      });

      await tx.creatorTemplate.deleteMany({
        where: { creatorId: id },
      });

      await tx.creator.deleteMany({
        where: { id },
      });

      return true;
    });

    if (!deleted) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    logCreatorRouteError({
      route: "creators.delete",
      creatorId: id,
      payloadKeys: [],
      error,
    });

    return NextResponse.json({ error: getCreatorDeleteErrorMessage(error) }, { status: getStatusForError(error) });
  }
}

async function readExistingCreatorContext(prisma: ReturnType<typeof getPrisma>, id: string): Promise<ExistingCreatorContext | null> {
  try {
    const creator = await prisma.creator.findUnique({
      where: { id },
      select: {
        id: true,
        stage: true,
        nextAction: true,
        tier: true,
        exactStep: true,
        visualFitScore: true,
        commercialFitScore: true,
        contentQuality: true,
        trustPurchaseIntentScore: true,
        overallScoreOverride: true,
      },
    });

    if (!creator) {
      return null;
    }

    return {
      ...creator,
      exactStep: isExactStepValue(creator.exactStep) ? creator.exactStep : null,
      compatibilityMode: false,
    };
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }

    const creator = await prisma.creator.findUnique({
      where: { id },
      select: {
        id: true,
        stage: true,
        nextAction: true,
        visualFitScore: true,
        commercialFitScore: true,
        contentQuality: true,
        trustPurchaseIntentScore: true,
        overallScoreOverride: true,
      },
    });

    if (!creator) {
      return null;
    }

    return {
      ...creator,
      tier: null,
      exactStep: getLegacyExactStepFromStage(creator.stage, creator.nextAction, null),
      compatibilityMode: true,
    };
  }
}

function buildWorkflowPatch(
  parsed: CreatorUpdatePayload,
  existing: ExistingCreatorContext,
): Partial<CreatorUpdatePayload> & { stage?: ExistingCreatorContext["stage"] } {
  let exactStep = parsed.exactStep && isExactStepValue(parsed.exactStep) ? parsed.exactStep : null;

  if (!exactStep && parsed.tier) {
    exactStep = getSuggestedExactStepForTier(parsed.tier);
  }

  if (!exactStep && parsed.stage) {
    exactStep = getLegacyExactStepFromStage(parsed.stage, parsed.nextAction ?? existing.nextAction, parsed.tier ?? existing.tier);
  }

  if (!exactStep) {
    return {};
  }

  const workflowPatch = getWorkflowPatchForExactStep(exactStep);
  const effectiveTier = parsed.tier ?? existing.tier;

  return {
    ...workflowPatch,
    nextAction: parsed.nextAction ?? workflowPatch.nextAction ?? existing.nextAction ?? getSuggestedNextAction(parsed.tier ?? existing.tier),
    bossApprovalNeeded:
      parsed.bossApprovalNeeded ??
      (effectiveTier === "TIER_1" ? true : effectiveTier ? false : undefined),
  } satisfies Partial<CreatorUpdatePayload> & { stage?: ExistingCreatorContext["stage"] };
}

function buildLegacyCompatibleUpdate(fullUpdate: Record<string, unknown>) {
  return stripUndefined(
    Object.fromEntries(
      Object.entries(fullUpdate).filter(([key]) => legacySafeUpdateKeys.has(key)),
    ),
  );
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function getCreatorUpdateErrorMessage(error: unknown) {
  if (isPrismaError(error) && error.code === "P2002") {
    return "A creator with this platform and handle already exists.";
  }

  if (isPrismaSchemaDriftError(error)) {
    return "This change needs the additive Prisma migrations before preview/production can store the new workflow fields.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Creator update failed.";
}

function getCreatorDeleteErrorMessage(error: unknown) {
  if (isPrismaError(error) && (error.code === "P2021" || error.code === "P2022")) {
    return "Delete failed because production is using an older database schema. Run Prisma migrations, then retry.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Creator delete failed.";
}

function getStatusForError(error: unknown) {
  if (isPrismaError(error) && error.code === "P2002") {
    return 409;
  }

  if (isPrismaSchemaDriftError(error)) {
    return 409;
  }

  return 500;
}

function isPrismaError(error: unknown): error is { code: string } {
  return Boolean(error && typeof error === "object" && "code" in error);
}

function logCreatorRouteError({
  route,
  creatorId,
  payloadKeys,
  error,
}: {
  route: string;
  creatorId: string;
  payloadKeys: string[];
  error: unknown;
}) {
  console.error("[HAUS Creator OS API]", {
    route,
    creatorId,
    payloadKeys,
    error: error instanceof Error ? error.message : String(error),
  });
}
