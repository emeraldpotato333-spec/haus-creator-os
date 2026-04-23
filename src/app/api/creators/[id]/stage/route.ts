import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { applyStageAutomation } from "@/lib/automation";
import { evaluationSuggestion } from "@/lib/domain";
import { pipelineStageSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
  const method = request.method;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logStageRouteError({
      route: "creators.stage",
      creatorId: id,
      method,
      payloadKeys: [],
      error,
    });

    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const payloadKeys = payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload) : [];
  const stageResult = pipelineStageSchema.safeParse(
    payload && typeof payload === "object" && "stage" in payload ? payload.stage : undefined,
  );

  if (!stageResult.success) {
    const error = "Invalid stage. Choose a real pipeline stage.";

    logStageRouteError({
      route: "creators.stage",
      creatorId: id,
      method,
      payloadKeys,
      error,
    });

    return NextResponse.json({ error }, { status: 400 });
  }

  const stage = stageResult.data;
  const existing = await prisma.creator.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  try {
    const creator = await prisma.creator.update({
      where: { id },
      data: {
        stage,
        stageChangedAt: new Date(),
      },
    });

    let task = null;
    let automationWarning: string | undefined;

    try {
      task = await applyStageAutomation(prisma, id, stage);
      await prisma.interaction.create({
        data: {
          creatorId: id,
          type: "INTERNAL",
          title: "Pipeline stage updated",
          body: `${existing.stage} -> ${stage}`,
        },
      });
    } catch (error) {
      automationWarning = "Stage changed, but follow-up automation failed.";
      logStageRouteError({
        route: "creators.stage.automation",
        creatorId: id,
        method,
        payloadKeys,
        error,
      });
    }

    return NextResponse.json({
      creator,
      task,
      suggestion: evaluationSuggestion(creator.stage, creator.overallScore),
      automationWarning,
    });
  } catch (error) {
    logStageRouteError({
      route: "creators.stage",
      creatorId: id,
      method,
      payloadKeys,
      error,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stage update failed." },
      { status: 500 },
    );
  }
}

function logStageRouteError({
  route,
  creatorId,
  method,
  payloadKeys,
  error,
}: {
  route: string;
  creatorId: string;
  method: string;
  payloadKeys: string[];
  error: unknown;
}) {
  console.error("[HAUS Creator OS API]", {
    route,
    creatorId,
    method,
    payloadKeys,
    error: error instanceof Error ? error.message : String(error),
  });
}
