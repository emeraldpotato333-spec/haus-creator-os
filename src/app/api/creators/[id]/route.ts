import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { SCORE_FIELDS, calculateOverallScore } from "@/lib/domain";
import { applyStageAutomation } from "@/lib/automation";
import { creatorUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CreatorUpdatePayload = z.infer<typeof creatorUpdateSchema>;

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
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
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
  const method = request.method;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logCreatorRouteError({
      route: "creators.update",
      creatorId: id,
      method,
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

    logCreatorRouteError({
      route: "creators.update",
      creatorId: id,
      method,
      payloadKeys,
      error: message,
    });

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
  const updateData: Prisma.CreatorUpdateInput = parsed;
  const existing = await prisma.creator.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const scoreValues = Object.fromEntries(
    SCORE_FIELDS.map((field) => [field.key, parsed[field.key] ?? existing[field.key]]),
  ) as Record<(typeof SCORE_FIELDS)[number]["key"], number>;

  const nextStage = parsed.stage ?? existing.stage;
  let creator;

  try {
    creator = await prisma.creator.update({
      where: { id },
      data: {
        ...updateData,
        overallScore: calculateOverallScore(scoreValues),
        ...(parsed.stage && parsed.stage !== existing.stage
          ? { stageChangedAt: new Date() }
          : {}),
      },
    });
  } catch (error) {
    const message = getCreatorUpdateErrorMessage(error);

    logCreatorRouteError({
      route: "creators.update",
      creatorId: id,
      method,
      payloadKeys,
      error,
    });

    return NextResponse.json({ error: message }, { status: getStatusForError(error) });
  }

  let automationWarning: string | undefined;

  if (parsed.stage && parsed.stage !== existing.stage) {
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
        method,
        payloadKeys,
        error,
      });
    }
  }

  return NextResponse.json({ ...creator, automationWarning });
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function getCreatorUpdateErrorMessage(error: unknown) {
  if (isPrismaError(error) && error.code === "P2002") {
    return "A creator with this platform and handle already exists.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Creator update failed.";
}

function getStatusForError(error: unknown) {
  if (isPrismaError(error) && error.code === "P2002") {
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
