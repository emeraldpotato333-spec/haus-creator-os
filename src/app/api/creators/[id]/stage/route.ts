import { NextRequest, NextResponse } from "next/server";
import { applyStageAutomation } from "@/lib/automation";
import {
  ExactStepValue,
  getDefaultExactStepForLane,
  getExactStepConfig,
  getLegacyExactStepFromStage,
  getWorkflowPatchForExactStep,
  isExactStepValue,
  type WorkflowLane,
} from "@/lib/creator-command-center";
import { evaluationSuggestion } from "@/lib/domain";
import { isPrismaSchemaDriftError } from "@/lib/prisma-compat";
import { getPrisma } from "@/lib/prisma";
import { pipelineStageSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CreatorStageContext = {
  id: string;
  stage: ReturnType<typeof pipelineStageSchema.parse>;
  nextAction: string | null;
  tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  exactStep: ExactStepValue | null;
  projectType: string | null;
  collabAngle: string | null;
  overallScore: number;
  compatibilityMode: boolean;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logStageRouteError({
      route: "creators.stage",
      creatorId: id,
      payloadKeys: [],
      error,
    });

    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const payloadKeys = payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload) : [];
  const requestedExactStep = getRequestedExactStep(payload);
  const requestedStage = getRequestedStage(payload);
  const requestedLane = getRequestedLane(payload);

  if (!requestedExactStep && !requestedStage && !requestedLane) {
    return NextResponse.json(
      { error: "Choose a real exact step or lane." },
      { status: 400 },
    );
  }

  const existing = await readCreatorStageContext(prisma, id);

  if (!existing) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const exactStep =
    requestedExactStep ??
    (requestedLane
      ? getDefaultExactStepForLane(requestedLane, existing)
      : requestedStage
        ? getLegacyExactStepFromStage(requestedStage, existing.nextAction, existing.tier)
        : existing.exactStep ?? getLegacyExactStepFromStage(existing.stage, existing.nextAction, existing.tier));
  const stage = requestedStage ?? getExactStepConfig(exactStep)?.stage ?? existing.stage;
  const workflowPatch = getWorkflowPatchForExactStep(exactStep);
  const stageChanged = stage !== existing.stage;

  try {
    const updateData = existing.compatibilityMode
      ? {
          stage,
          stageChangedAt: stageChanged ? new Date() : undefined,
          nextAction: workflowPatch.nextAction,
        }
      : {
          ...workflowPatch,
          stageChangedAt: stageChanged ? new Date() : undefined,
        };

    const creator = await prisma.creator.update({
      where: { id },
      data: stripUndefined(updateData),
    });

    let task = null;
    let automationWarning: string | undefined;

    if (stageChanged) {
      try {
        task = await applyStageAutomation(prisma, id, stage);
        await prisma.interaction.create({
          data: {
            creatorId: id,
            type: "INTERNAL",
            title: "Pipeline step updated",
            body: `${existing.stage} -> ${stage} (${workflowPatch.exactStep})`,
          },
        });
      } catch (error) {
        automationWarning = "Saved, but stage follow-up automation failed.";
        logStageRouteError({
          route: "creators.stage.automation",
          creatorId: id,
          payloadKeys,
          error,
        });
      }
    }

    return NextResponse.json({
      creator: {
        ...creator,
        exactStep: existing.compatibilityMode ? null : workflowPatch.exactStep,
      },
      task,
      exactStep: workflowPatch.exactStep,
      suggestion: evaluationSuggestion(stage, creator.overallScore),
      automationWarning,
      compatibilityMode: existing.compatibilityMode,
      schemaWarning: existing.compatibilityMode
        ? "Preview DB is missing the additive command-center fields. Stage and next action were saved, but exact-step/status fields need the Prisma migrations."
        : undefined,
    });
  } catch (error) {
    logStageRouteError({
      route: "creators.stage",
      creatorId: id,
      payloadKeys,
      error,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Stage update failed.",
      },
      { status: 500 },
    );
  }
}

async function readCreatorStageContext(prisma: ReturnType<typeof getPrisma>, id: string): Promise<CreatorStageContext | null> {
  try {
    const creator = await prisma.creator.findUnique({
      where: { id },
      select: {
        id: true,
        stage: true,
        nextAction: true,
        tier: true,
        exactStep: true,
        projectType: true,
        collabAngle: true,
        overallScore: true,
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
        overallScore: true,
      },
    });

    if (!creator) {
      return null;
    }

    return {
      ...creator,
      tier: null,
      exactStep: getLegacyExactStepFromStage(creator.stage, creator.nextAction, null),
      projectType: null,
      collabAngle: null,
      compatibilityMode: true,
    };
  }
}

function getRequestedExactStep(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("exactStep" in payload)) {
    return null;
  }

  return isExactStepValue(payload.exactStep) ? payload.exactStep : null;
}

function getRequestedStage(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("stage" in payload)) {
    return null;
  }

  const result = pipelineStageSchema.safeParse(payload.stage);
  return result.success ? result.data : null;
}

function getRequestedLane(payload: unknown): WorkflowLane | null {
  if (!payload || typeof payload !== "object" || !("lane" in payload)) {
    return null;
  }

  const value = payload.lane;
  return value === "DECIDE" || value === "OUTREACH" || value === "COMMIT" || value === "ASSET" ? value : null;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function logStageRouteError({
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
