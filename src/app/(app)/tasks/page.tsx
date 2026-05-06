import { PageHeading } from "@/components/app/page-heading";
import { RuntimeNotice } from "@/components/app/runtime-notice";
import { TasksClient } from "@/components/tasks/tasks-client";
import { getPrismaPageNotice, logPrismaPageError } from "@/lib/prisma-compat";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { tasks, creators, creatorActions, notices } = await loadTasksPageData();

  return (
    <>
      <PageHeading eyebrow="Next actions" title="Tasks" />
      <RuntimeNotice notices={notices} />
      <TasksClient tasks={serialize(tasks)} creators={serialize(creators)} creatorActions={serialize(creatorActions)} />
    </>
  );
}

async function loadTasksPageData() {
  const prisma = getPrisma();

  try {
    const [tasks, creators, creatorActions] = await Promise.all([
      prisma.task.findMany({
        select: {
          id: true,
          title: true,
          details: true,
          status: true,
          priority: true,
          dueDate: true,
          creator: {
            select: {
              id: true,
              name: true,
              handle: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      }),
      prisma.creator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, handle: true } }),
      prisma.creator.findMany({
        where: {
          nextAction: { not: null },
        },
        orderBy: [{ isTodayFocus: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          name: true,
          handle: true,
          stage: true,
          nextAction: true,
          tier: true,
          bossApprovalStatus: true,
          sampleStatus: true,
        },
      }),
    ]);

    return { tasks, creators, creatorActions, notices: [] as string[] };
  } catch (error) {
    logPrismaPageError("tasks.current", error);

    try {
      const tasks = await prisma.task.findMany({
        select: {
          id: true,
          title: true,
          details: true,
          status: true,
          priority: true,
          dueDate: true,
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      });

      return {
        tasks: tasks.map((task) => ({ ...task, creator: null })),
        creators: [],
        creatorActions: [],
        notices: ["Tasks loaded without creator lookups. Run Prisma migrations so linked creator fields are available."],
      };
    } catch (fallbackError) {
      logPrismaPageError("tasks.fallback", fallbackError);
    }

    return {
      tasks: [],
      creators: [],
      creatorActions: [],
      notices: [getPrismaPageNotice("Tasks", error)],
    };
  }
}
