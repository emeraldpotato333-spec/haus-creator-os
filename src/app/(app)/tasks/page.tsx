import { PageHeading } from "@/components/app/page-heading";
import { TasksClient } from "@/components/tasks/tasks-client";
import { getPrisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const prisma = getPrisma();
  const [tasks, creators] = await Promise.all([
    prisma.task.findMany({
      include: { creator: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.creator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeading eyebrow="Next actions" title="Tasks" />
      <TasksClient tasks={serialize(tasks)} creators={serialize(creators)} />
    </>
  );
}
