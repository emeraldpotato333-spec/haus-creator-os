import { NextRequest, NextResponse } from "next/server";
import { unparse } from "papaparse";
import { getPrisma } from "@/lib/prisma";
import { stageLabel } from "@/lib/domain";

export async function GET(request: NextRequest) {
  const prisma = getPrisma();
  const type = new URL(request.url).searchParams.get("type") ?? "json";

  if (type === "creators-csv") {
    const creators = await prisma.creator.findMany({ orderBy: { updatedAt: "desc" } });
    const csv = unparse(
      creators.map((creator) => ({
        name: creator.name,
        handle: creator.handle,
        platform: creator.platform,
        stage: stageLabel(creator.stage),
        niche: creator.niche,
        followers: creator.followers,
        engagementRate: creator.engagementRate,
        overallScore: creator.overallScore,
        email: creator.email,
        profileUrl: creator.profileUrl,
        tags: creator.tags.join("; "),
      })),
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=haus-creators.csv",
      },
    });
  }

  if (type === "tasks-csv") {
    const tasks = await prisma.task.findMany({
      include: { creator: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
    const csv = unparse(
      tasks.map((task) => ({
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString() ?? "",
        creator: task.creator?.name ?? "",
        handle: task.creator?.handle ?? "",
        details: task.details,
      })),
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=haus-tasks.csv",
      },
    });
  }

  const [settings, creators, templates, tasks, interactions, briefs] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "app" } }),
    prisma.creator.findMany({ include: { linkedTemplates: true } }),
    prisma.template.findMany(),
    prisma.task.findMany(),
    prisma.interaction.findMany(),
    prisma.brief.findMany(),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    settings,
    creators,
    templates,
    tasks,
    interactions,
    briefs,
  });
}
