import type { PipelineStage, PrismaClient } from "@/generated/prisma/client";
import { addDays } from "date-fns";
import { AUTOMATION_RULES } from "@/lib/domain";

export async function applyStageAutomation(
  prisma: PrismaClient,
  creatorId: string,
  stage: PipelineStage,
) {
  const rule = AUTOMATION_RULES[stage];

  if (!rule) {
    return null;
  }

  const existing = await prisma.task.findFirst({
    where: {
      creatorId,
      automationKey: rule.key,
      status: { not: "DONE" },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.task.create({
    data: {
      creatorId,
      title: rule.title,
      details: rule.details,
      dueDate: addDays(new Date(), rule.dueInDays),
      automationKey: rule.key,
      priority: "MEDIUM",
    },
  });
}
