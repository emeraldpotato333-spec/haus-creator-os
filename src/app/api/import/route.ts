import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

const dateFields = new Set(["createdAt", "updatedAt", "dueDate", "sentAt", "completedAt", "happenedAt", "stageChangedAt"]);

function reviveDates<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      dateFields.has(key) && typeof value === "string" ? new Date(value) : value,
    ]),
  ) as T;
}

export async function POST(request: NextRequest) {
  const prisma = getPrisma();
  const payload = await request.json();

  if (!payload || !Array.isArray(payload.creators) || !Array.isArray(payload.templates)) {
    return NextResponse.json({ error: "Invalid HAUS export JSON." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.creatorTemplate.deleteMany();
    await tx.brief.deleteMany();
    await tx.interaction.deleteMany();
    await tx.task.deleteMany();
    await tx.creator.deleteMany();
    await tx.template.deleteMany();

    if (payload.settings) {
      await tx.appSettings.upsert({
        where: { id: "app" },
        update: reviveDates(payload.settings),
        create: reviveDates(payload.settings),
      });
    }

    for (const template of payload.templates) {
      await tx.template.create({ data: reviveDates(template) });
    }

    for (const creator of payload.creators) {
      const { interactions, tasks, briefs, linkedTemplates, ...creatorData } = creator;
      await tx.creator.create({ data: reviveDates(creatorData) });
      void interactions;
      void tasks;
      void briefs;
      void linkedTemplates;
    }

    for (const task of payload.tasks ?? []) {
      await tx.task.create({ data: reviveDates(task) });
    }

    for (const interaction of payload.interactions ?? []) {
      await tx.interaction.create({ data: reviveDates(interaction) });
    }

    for (const brief of payload.briefs ?? []) {
      await tx.brief.create({ data: reviveDates(brief) });
    }

    for (const creator of payload.creators) {
      for (const linkedTemplate of creator.linkedTemplates ?? []) {
        await tx.creatorTemplate.create({ data: reviveDates(linkedTemplate) });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
