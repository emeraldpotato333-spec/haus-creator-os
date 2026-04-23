import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { SCORE_FIELDS, calculateOverallScore } from "@/lib/domain";
import { applyStageAutomation } from "@/lib/automation";
import { creatorInputSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
  const payload = await request.json();
  const parsed = creatorInputSchema.partial().parse(payload);
  const existing = await prisma.creator.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const scoreValues = Object.fromEntries(
    SCORE_FIELDS.map((field) => [field.key, parsed[field.key] ?? existing[field.key]]),
  ) as Record<(typeof SCORE_FIELDS)[number]["key"], number>;

  const nextStage = parsed.stage ?? existing.stage;
  const creator = await prisma.creator.update({
    where: { id },
    data: {
      ...parsed,
      overallScore: calculateOverallScore(scoreValues),
      ...(parsed.stage && parsed.stage !== existing.stage
        ? { stageChangedAt: new Date() }
        : {}),
    },
  });

  if (parsed.stage && parsed.stage !== existing.stage) {
    await applyStageAutomation(prisma, id, nextStage);
    await prisma.interaction.create({
      data: {
        creatorId: id,
        type: "INTERNAL",
        title: "Stage changed",
        body: `${existing.stage} -> ${nextStage}`,
      },
    });
  }

  return NextResponse.json(creator);
}
