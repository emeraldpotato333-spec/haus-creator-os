import Link from "next/link";
import { isBefore, startOfDay } from "date-fns";
import { ArrowRight, Clock, Sparkles, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/app/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPrisma } from "@/lib/prisma";
import { formatMoney, stageLabel } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const prisma = getPrisma();
  const today = startOfDay(new Date());
  const [creators, tasks, recent] = await Promise.all([
    prisma.creator.findMany(),
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      include: { creator: true },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.creator.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);

  const todaysTasks = tasks.filter((task) => task.dueDate && !isBefore(task.dueDate, today));
  const overdueTasks = tasks.filter((task) => task.dueDate && isBefore(task.dueDate, today));
  const highScore = creators.filter((creator) => creator.overallScore >= 8).length;
  const liveRevenue = creators.reduce((sum, creator) => sum + creator.revenueCents, 0);

  return (
    <>
      <PageHeading eyebrow="Today" title="Creator desk">
        <div className="text-right text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
        </div>
      </PageHeading>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Active creators" value={creators.length.toString()} helper="Across all stages" />
        <StatCard label="High-fit creators" value={highScore.toString()} helper="Overall score 8+" />
        <StatCard label="Open tasks" value={tasks.length.toString()} helper={`${overdueTasks.length} overdue`} />
        <StatCard label="Tracked revenue" value={formatMoney(liveRevenue)} helper="From seeded creator performance" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="haus-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" />
              Today and overdue
            </CardTitle>
            <Link href="/tasks" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              Tasks <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[...overdueTasks, ...todaysTasks].slice(0, 8).map((task) => (
              <Link
                href={task.creator ? `/creators/${task.creator.id}` : "/tasks"}
                key={task.id}
                className="grid gap-1 rounded-md border bg-background/60 p-3 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={overdueTasks.includes(task) ? "destructive" : "secondary"}>
                    {overdueTasks.includes(task) ? "Overdue" : "Due"}
                  </Badge>
                  <span className="font-medium">{task.title}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {task.creator?.name ?? "General"} {task.dueDate ? `· ${task.dueDate.toLocaleDateString()}` : ""}
                </div>
              </Link>
            ))}
            {tasks.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No open tasks. The desk is clear.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="haus-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRound className="size-4" />
              Recently updated
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1">
            {recent.map((creator, index) => (
              <Link
                key={creator.id}
                href={`/creators/${creator.id}`}
                className="grid gap-2 rounded-md px-2 py-3 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{creator.name}</div>
                    <div className="text-sm text-muted-foreground">{creator.handle}</div>
                  </div>
                  <Badge variant="outline">{stageLabel(creator.stage)}</Badge>
                </div>
                {index !== recent.length - 1 ? <Separator /> : null}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 rounded-md border bg-accent/30 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-4" />
          <div>
            <div className="font-medium">Next best move</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Push high-score evaluated creators into Expanded or Ambassador, then keep the live-content queue tight so
              HAUS learns quickly from each activation.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card className="haus-panel">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-4 font-mono text-3xl tracking-tight">{value}</div>
        <div className="mt-2 text-xs text-muted-foreground">{helper}</div>
      </CardContent>
    </Card>
  );
}
