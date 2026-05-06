import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getSuggestedExactStepForTier, getSuggestedNextAction, getWorkflowPatchForExactStep, isExactStepValue } from "@/lib/creator-command-center";
import { getPrisma } from "@/lib/prisma";
import { isPrismaSchemaDriftError } from "@/lib/prisma-compat";
import { creatorInputSchema, withOverallScore } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const prisma = getPrisma();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const stage = searchParams.get("stage")?.trim();

  const creators = await prisma.creator.findMany({
    where: {
      ...(stage && stage !== "ALL" ? { stage: stage as never } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { handle: { contains: query, mode: "insensitive" } },
              { niche: { contains: query, mode: "insensitive" } },
              { tags: { has: query } },
            ],
          }
        : {}),
    },
    include: {
      tasks: true,
      interactions: { orderBy: { happenedAt: "desc" }, take: 1 },
      briefs: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return NextResponse.json(creators);
}

export async function POST(request: NextRequest) {
  const prisma = getPrisma();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsedResult = creatorInputSchema.safeParse(payload);

  if (!parsedResult.success) {
    const firstIssue = parsedResult.error.issues[0];
    const field = firstIssue?.path.join(".") || "payload";
    return NextResponse.json(
      {
        error: `Invalid ${field}: ${firstIssue?.message || "check the submitted value"}`,
        details: parsedResult.error.issues.map((issue) => ({
          field: issue.path.join(".") || "payload",
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const parsed = withOverallScore(applyWorkflowDefaults(parsedResult.data));

  try {
    const creator = await createCreator(prisma, parsed);
    await createCreatorAddedInteraction(prisma, creator.id, parsed.whyFit ?? parsed.notes ?? "");
    return NextResponse.json(creator, { status: 201 });
  } catch (error) {
    console.error("[HAUS Creator OS API]", {
      route: "creators.create",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: getCreateErrorMessage(error) }, { status: getCreateStatus(error) });
  }
}

async function createCreator(prisma: ReturnType<typeof getPrisma>, data: ReturnType<typeof withOverallScore>) {
  try {
    return await prisma.creator.create({
      data,
    });
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }

    return createCreatorLegacy(prisma, data);
  }
}

async function createCreatorLegacy(prisma: ReturnType<typeof getPrisma>, data: ReturnType<typeof withOverallScore>) {
  const id = randomUUID();
  const now = new Date();
  const tagsSql = data.tags.length
    ? Prisma.sql`ARRAY[${Prisma.join(data.tags)}]::TEXT[]`
    : Prisma.sql`ARRAY[]::TEXT[]`;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    handle: string;
    platform: string;
    whyFit: string | null;
    notes: string;
    overallScore: number;
    stage: string;
    priority: string;
    createdAt: Date;
    updatedAt: Date;
  }>>(Prisma.sql`
    INSERT INTO "Creator" (
      "id",
      "name",
      "handle",
      "platform",
      "profileUrl",
      "email",
      "location",
      "niche",
      "source",
      "audienceSummary",
      "whyFit",
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
      "priority",
      "audienceFit",
      "contentQuality",
      "aestheticFit",
      "authorityTrust",
      "logisticsFit",
      "purchaseIntent",
      "overallScore",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${data.name},
      ${data.handle},
      ${data.platform},
      ${data.profileUrl},
      ${data.email},
      ${data.location},
      ${data.niche},
      ${data.source},
      ${data.audienceSummary},
      ${data.whyFit ?? data.nextAction ?? null},
      ${data.notes},
      ${tagsSql},
      ${data.followers},
      ${data.engagementRate},
      ${data.estimatedReach},
      ${data.contentLiveUrl},
      ${data.affiliateCode},
      ${data.conversions},
      ${data.revenueCents},
      CAST(${data.stage} AS "PipelineStage"),
      CAST(${data.priority} AS "TaskPriority"),
      ${data.commercialFitScore},
      ${data.contentQuality},
      ${data.visualFitScore},
      ${data.trustPurchaseIntentScore},
      ${0},
      ${data.trustPurchaseIntentScore},
      ${data.overallScore},
      ${now}
    )
    RETURNING
      "id",
      "name",
      "handle",
      "platform",
      "whyFit",
      "notes",
      "overallScore",
      "stage",
      "priority",
      "createdAt",
      "updatedAt"
  `);

  const creator = rows[0];

  if (!creator) {
    throw new Error("Creator could not be created in compatibility mode.");
  }

  return creator;
}

async function createCreatorAddedInteraction(
  prisma: ReturnType<typeof getPrisma>,
  creatorId: string,
  body: string,
) {
  try {
    await prisma.interaction.create({
      data: {
        creatorId,
        type: "NOTE",
        title: "Creator added",
        body,
      },
    });
  } catch (error) {
    console.warn("[HAUS Creator OS API]", {
      route: "creators.create.interaction",
      creatorId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function applyWorkflowDefaults(data: ReturnType<typeof creatorInputSchema.parse>) {
  const exactStep = data.exactStep && isExactStepValue(data.exactStep)
    ? data.exactStep
    : getSuggestedExactStepForTier(data.tier ?? null);
  const workflowPatch = exactStep ? getWorkflowPatchForExactStep(exactStep) : null;

  return {
    ...data,
    ...workflowPatch,
    nextAction:
      data.nextAction ??
      workflowPatch?.nextAction ??
      getSuggestedNextAction(data.tier ?? null) ??
      null,
    bossApprovalNeeded:
      data.bossApprovalNeeded ?? (data.tier === "TIER_1" ? true : data.tier ? false : null),
  };
}

function getCreateErrorMessage(error: unknown) {
  if (isDuplicateCreatorError(error)) {
    return "A creator with this platform and handle already exists.";
  }

  if (isPrismaSchemaDriftError(error)) {
    return "Create failed because the production database schema is older than the app code. Run Prisma migrations, then retry.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Creator could not be added.";
}

function getCreateStatus(error: unknown) {
  if (isDuplicateCreatorError(error)) {
    return 409;
  }

  if (isPrismaSchemaDriftError(error)) {
    return 500;
  }

  return 500;
}

function isPrismaError(error: unknown): error is { code: string } {
  return Boolean(error && typeof error === "object" && "code" in error);
}

function isDuplicateCreatorError(error: unknown) {
  if (isPrismaError(error) && (error.code === "P2002" || error.code === "23505")) {
    return true;
  }

  return error instanceof Error && error.message.includes("Creator_platform_handle_key");
}
