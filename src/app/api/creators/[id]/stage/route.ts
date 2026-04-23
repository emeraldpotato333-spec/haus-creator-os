import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { applyStageAutomation } from "@/lib/automation";
import { evaluationSuggestion } from "@/lib/domain";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const prisma = getPrisma();
  const { stage } = await request.json();
  const existing = await prisma.creator.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const creator = await prisma.creator.update({
    where: { id },
    data: {
      stage,
      stageChangedAt: new Date(),
    },
  });

  const task = await applyStageAutomation(prisma, id, stage);

  await prisma.interaction.create({
    data: {
      creatorId: id,
      type: "INTERNAL",
      title: "Pipeline stage updated",
      body: `${existing.stage} -> ${stage}`,
    },
  });

  return NextResponse.json({
    creator,
    task,
    suggestion: evaluationSuggestion(creator.stage, creator.overallScore),
  });
}
