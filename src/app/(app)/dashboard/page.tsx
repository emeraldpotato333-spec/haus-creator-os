import Link from "next/link";
import { addDays, endOfWeek, isBefore, isWithinInterval, startOfDay, startOfWeek } from "date-fns";
import { AlertCircle, ArrowRight, Clock3, Layers3, Target, UsersRound } from "lucide-react";
import type { PrismaClient } from "@/generated/prisma/client";
import { LoadDemoButton } from "@/components/app/load-demo-button";
import { PageHeading } from "@/components/app/page-heading";
import { CreatorAvatar, PriorityBadge, StageBadge } from "@/components/creators/creator-identity";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPrisma } from "@/lib/prisma";
import { PIPELINE_STAGES, formatMoney } from "@/lib/domain";

export const dynamic = "force-dynamic";

type DashboardCreator = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  profileImageUrl: string | null;
  stage: (typeof PIPELINE_STAGES)[number]["value"];
  priority: "LOW" | "MEDIUM" | "HIGH";
  overallScore: number;
  revenueCents: number;
  nextFollowUpAt: Date | null;
  nextAction: string | null;
};

type DashboardTask = {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: Date | null;
  creator: { id: string; name: string } | null;
};

export default async function DashboardPage() {
  const dashboard = await loadDashboardData();
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const { creators, tasks, notices } = dashboard;

  if (creators.length === 0 && tasks.length === 0) {
    return (
      <>
        <PageHeading eyebrow="Today" title="Creator desk" />
        <div className="grid gap-4">
          {notices.length ? <DashboardNotice notices={notices} /> : null}
          <DeskEmptyState />
        </div>
      </>
    );
  }

  const openTasks = tasks.filter((task) => task.status !== "DONE");
  const overdueTasks = openTasks.filter((task) => task.dueDate && isBefore(task.dueDate, today));
  const dueThisWeek = openTasks.filter((task) =>
    task.dueDate ? isWithinInterval(task.dueDate, { start: weekStart, end: addDays(weekEnd, 1) }) : false,
  );
  const followUpCreators = creators
    .filter((creator) => creator.nextFollowUpAt && creator.nextFollowUpAt <= weekEnd)
    .sort((a, b) => (a.nextFollowUpAt?.getTime() ?? 0) - (b.nextFollowUpAt?.getTime() ?? 0));

  const pipelineCounts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: creators.filter((creator) => creator.stage === stage.value).length,
  }));
  const priorityCounts = ["HIGH", "MEDIUM", "LOW"].map((priority) => ({
    label: priority,
    count: creators.filter((creator) => creator.priority === priority).length,
  }));
  const scoreCounts = [
    { label: "8-10", count: creators.filter((creator) => creator.overallScore >= 8).length },
    { label: "6-7.9", count: creators.filter((creator) => creator.overallScore >= 6 && creator.overallScore < 8).length },
    { label: "<6", count: creators.filter((creator) => creator.overallScore < 6).length },
  ];

  return (
    <>
      <PageHeading eyebrow="Today" title="Creator desk">
        <div className="text-right text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
        </div>
      </PageHeading>

      <div className="grid gap-4">
        {notices.length ? <DashboardNotice notices={notices} /> : null}

        <div className="grid gap-4 xl:grid-cols-4">
          <StatCard label="Open tasks" value={openTasks.length.toString()} helper={`${overdueTasks.length} overdue`} />
          <StatCard label="Due this week" value={dueThisWeek.length.toString()} helper="Actionable in the next seven days" />
          <StatCard label="High-fit creators" value={creators.filter((creator) => creator.overallScore >= 8).length.toString()} helper="Ready for sharper outreach" />
          <StatCard label="Tracked revenue" value={formatMoney(creators.reduce((sum, creator) => sum + creator.revenueCents, 0))} helper="Performance already on the desk" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SnapshotCard
            title="Pipeline by stage"
            icon={<Layers3 className="size-4" />}
            rows={pipelineCounts.map((item) => ({ label: item.label, value: item.count, total: creators.length }))}
          />
          <SnapshotCard
            title="Fit score distribution"
            icon={<Target className="size-4" />}
            rows={scoreCounts.map((item) => ({ label: item.label, value: item.count, total: creators.length }))}
          />
          <SnapshotCard
            title="Priority breakdown"
            icon={<UsersRound className="size-4" />}
            rows={priorityCounts.map((item) => ({ label: item.label, value: item.count, total: creators.length }))}
          />
          <Card className="haus-panel">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="size-4" />
                Tasks due this week
              </CardTitle>
              <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </CardHeader>
            <CardContent className="grid gap-3">
              {dueThisWeek.slice(0, 5).map((task) => (
                <div key={task.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{task.title}</div>
                    <Badge variant={task.priority === "HIGH" ? "default" : "secondary"}>{task.priority}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {task.creator?.name ?? "General"} {task.dueDate ? `· ${task.dueDate.toLocaleDateString()}` : ""}
                  </div>
                </div>
              ))}
              {dueThisWeek.length === 0 ? <EmptyState text="Clear desk. No open tasks." /> : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="haus-panel">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Creators needing follow-up</CardTitle>
              <Link href="/creators" className="text-sm text-muted-foreground hover:text-foreground">
                Creators
              </Link>
            </CardHeader>
            <CardContent className="grid gap-3">
              {followUpCreators.slice(0, 6).map((creator) => (
                <Link key={creator.id} href={`/creators/${creator.id}`} className="rounded-md border p-3 transition-colors hover:bg-accent/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <CreatorAvatar creator={creator} />
                      <div>
                        <div className="font-medium">{creator.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <StageBadge stage={creator.stage} />
                          <PriorityBadge priority={creator.priority} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-mono">{creator.overallScore.toFixed(1)}</div>
                      <div className="text-muted-foreground">
                        {creator.nextFollowUpAt ? creator.nextFollowUpAt.toLocaleDateString() : "No date"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">{creator.nextAction || "Set the next action."}</div>
                </Link>
              ))}
              {followUpCreators.length === 0 ? <EmptyState text="No scheduled follow-ups yet." /> : null}
            </CardContent>
          </Card>

          <Card className="haus-panel">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Who to contact today</CardTitle>
              <Link href="/pipeline" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                Pipeline <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="grid gap-3">
              {creators
                .filter((creator) => creator.priority === "HIGH")
                .sort((a, b) => b.overallScore - a.overallScore)
                .slice(0, 5)
                .map((creator) => (
                  <Link key={creator.id} href={`/creators/${creator.id}`} className="rounded-md border p-3 transition-colors hover:bg-accent/20">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{creator.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{creator.handle} / {creator.platform}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xl">{creator.overallScore.toFixed(1)}</div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">fit</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">{creator.nextAction || "Set the next action."}</div>
                  </Link>
                ))}
              {creators.filter((creator) => creator.priority === "HIGH").length === 0 ? <EmptyState text="No high-priority creators yet." /> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

async function loadDashboardData() {
  try {
    const prisma = getPrisma();
    const [creatorsResult, tasksResult] = await Promise.all([
      loadDashboardCreators(prisma),
      loadDashboardTasks(prisma),
    ]);

    return {
      creators: creatorsResult.creators,
      tasks: tasksResult.tasks,
      notices: [...creatorsResult.notices, ...tasksResult.notices],
    };
  } catch (error) {
    logDashboardError("dashboard.init", error);

    return {
      creators: [] as DashboardCreator[],
      tasks: [] as DashboardTask[],
      notices: [getDashboardNotice(error)],
    };
  }
}

async function loadDashboardCreators(prisma: PrismaClient) {
  try {
    const creators = await prisma.creator.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        handle: true,
        platform: true,
        profileImageUrl: true,
        stage: true,
        priority: true,
        overallScore: true,
        revenueCents: true,
        nextFollowUpAt: true,
        nextAction: true,
        whyFit: true,
      },
    });

    return {
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name,
        handle: creator.handle,
        platform: creator.platform,
        profileImageUrl: creator.profileImageUrl,
        stage: creator.stage,
        priority: creator.priority,
        overallScore: creator.overallScore,
        revenueCents: creator.revenueCents,
        nextFollowUpAt: creator.nextFollowUpAt,
        nextAction: creator.nextAction || creator.whyFit || null,
      })),
      notices: [] as string[],
    };
  } catch (error) {
    logDashboardError("dashboard.creators.current", error);

    if (isPrismaSchemaDriftError(error)) {
      try {
        const legacyCreators = await prisma.creator.findMany({
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            handle: true,
            platform: true,
            stage: true,
            priority: true,
            overallScore: true,
            revenueCents: true,
            whyFit: true,
          },
        });

        return {
          creators: legacyCreators.map((creator) => ({
            id: creator.id,
            name: creator.name,
            handle: creator.handle,
            platform: creator.platform,
            profileImageUrl: null,
            stage: creator.stage,
            priority: creator.priority,
            overallScore: creator.overallScore,
            revenueCents: creator.revenueCents,
            nextFollowUpAt: null,
            nextAction: creator.whyFit || null,
          })),
          notices: ["Dashboard loaded in compatibility mode. Run Prisma migrations so the latest creator fields are available."],
        };
      } catch (legacyError) {
        logDashboardError("dashboard.creators.legacy", legacyError);
      }
    }

    return {
      creators: [] as DashboardCreator[],
      notices: [getDashboardNotice(error)],
    };
  }
}

async function loadDashboardTasks(prisma: PrismaClient) {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        dueDate: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        creator: task.creator,
      })),
      notices: [] as string[],
    };
  } catch (error) {
    logDashboardError("dashboard.tasks", error);

    return {
      tasks: [] as DashboardTask[],
      notices: [getDashboardNotice(error)],
    };
  }
}

function isPrismaSchemaDriftError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : null;

  return code === "P2021" || code === "P2022";
}

function getDashboardNotice(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    if (error.message.includes("DATABASE_URL")) {
      return "Dashboard could not connect to the database. Set DATABASE_URL in Vercel, then redeploy.";
    }
  }

  if (isPrismaSchemaDriftError(error)) {
    return "Dashboard could not read the latest schema. Run Prisma migrations on production and reload.";
  }

  return "Dashboard data is temporarily unavailable. The page is still loading in a safe empty state.";
}

function logDashboardError(scope: string, error: unknown) {
  console.error("[HAUS Creator OS dashboard]", {
    scope,
    error: error instanceof Error ? error.message : String(error),
  });
}

function DashboardNotice({ notices }: { notices: string[] }) {
  return (
    <div className="rounded-md border border-amber-300/60 bg-amber-100/80 p-4 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="grid gap-1">
          {Array.from(new Set(notices)).map((notice) => (
            <div key={notice}>{notice}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeskEmptyState() {
  return (
    <div className="rounded-md border border-dashed p-14 text-center">
      <div className="text-lg font-medium">No creators yet. Add your first creator.</div>
      <p className="mt-2 text-sm text-muted-foreground">The desk is empty on purpose. Start with a real lead or load demo data to explore the flow.</p>
      <div className="mt-5 flex justify-center gap-2">
        <LoadDemoButton />
        <Link href="/creators" className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-accent/30">
          Go to creators
        </Link>
      </div>
    </div>
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

function SnapshotCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; value: number; total: number }[];
}) {
  return (
    <Card className="haus-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1">
            <div className="flex items-center justify-between text-sm">
              <span>{row.label}</span>
              <span className="font-mono">{row.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground/80"
                style={{ width: `${row.total ? (row.value / row.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
