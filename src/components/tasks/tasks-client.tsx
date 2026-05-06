"use client";

import Link from "next/link";
import { startOfDay } from "date-fns";
import { useMemo, useState, useTransition } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { BossApprovalStatus, PipelineStage, SampleStatus } from "@/generated/prisma/client";
import { getTierShortLabel, isWaiting } from "@/lib/creator-command-center";
import { ConfirmActionDialog } from "@/components/app/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TaskRecord = {
  id: string;
  title: string;
  details: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string | Date | null;
  creator?: { id: string; name: string; handle: string } | null;
};

type CreatorOption = {
  id: string;
  name: string;
  handle?: string;
};

type CreatorAction = {
  id: string;
  name: string;
  handle: string;
  stage: PipelineStage;
  nextAction: string | null;
  tier?: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  bossApprovalStatus: BossApprovalStatus | null;
  sampleStatus: SampleStatus | null;
};

type TaskFilter = "OPEN" | "TODAY" | "OVERDUE" | "COMPLETED" | "ALL";

export function TasksClient({
  tasks,
  creators,
  creatorActions,
}: {
  tasks: TaskRecord[];
  creators: CreatorOption[];
  creatorActions: CreatorAction[];
}) {
  const [items, setItems] = useState(tasks);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<TaskFilter>("OPEN");
  const [deleteTarget, setDeleteTarget] = useState<TaskRecord | null>(null);
  const today = startOfDay(new Date());
  const visibleCreatorActions = useMemo(
    () => creatorActions.filter((creator) => !isWaiting(creator)).slice(0, 6),
    [creatorActions],
  );

  const openTasks = useMemo(() => items.filter((task) => task.status !== "DONE"), [items]);
  const completedTasks = useMemo(() => items.filter((task) => task.status === "DONE"), [items]);

  const visible = useMemo(
    () =>
      items.filter((task) => {
        const due = task.dueDate ? new Date(task.dueDate) : null;
        const isCompleted = task.status === "DONE";
        const isToday = due ? startOfDay(due).getTime() === today.getTime() : false;
        const isOverdue = due ? startOfDay(due).getTime() < today.getTime() && !isCompleted : false;

        switch (filter) {
          case "OPEN":
            return !isCompleted;
          case "TODAY":
            return isToday && !isCompleted;
          case "OVERDUE":
            return isOverdue;
          case "COMPLETED":
            return isCompleted;
          default:
            return true;
        }
      }),
    [filter, items, today],
  );

  function addTask(formData: FormData) {
    startTransition(async () => {
      const creatorId = formData.get("creatorId");
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          creatorId: creatorId === "NONE" ? null : creatorId,
          dueDate: formData.get("dueDate"),
          priority: formData.get("priority") || "MEDIUM",
        }),
      });

      if (!response.ok) {
        toast.error("Task could not be added.");
        return;
      }

      const task = await response.json();
      const matchedCreator = creators.find((creator) => creator.id === task.creatorId);
      setItems((current) => [
        {
          ...task,
          creator: matchedCreator
            ? { id: matchedCreator.id, name: matchedCreator.name, handle: matchedCreator.handle ?? "" }
            : null,
        },
        ...current,
      ]);
      toast.success("Task added.");
    });
  }

  function setStatus(task: TaskRecord, status: TaskRecord["status"]) {
    startTransition(async () => {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        toast.error("Task status could not be updated.");
        return;
      }

      const updated = await response.json();
      setItems((current) =>
        current.map((item) => (item.id === task.id ? { ...item, ...updated, creator: item.creator } : item)),
      );
    });
  }

  async function deleteTask() {
    if (!deleteTarget) {
      return;
    }

    const response = await fetch(`/api/tasks/${deleteTarget.id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Task could not be deleted.");
      return;
    }

    setItems((current) => current.filter((task) => task.id !== deleteTarget.id));
    toast.success("Task deleted.");
  }

  async function importCsv(file: File | undefined) {
    if (!file) {
      return;
    }

    const csv = await file.text();
    const response = await fetch("/api/import/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "tasks", csv }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? "Tasks CSV import failed.");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="grid gap-5">
      <Card className="haus-panel">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Actionable creator moves</CardTitle>
          <div className="text-sm text-muted-foreground">Only next actions belong here. Park the rest.</div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4">
          {visibleCreatorActions.length ? (
            visibleCreatorActions.map((creator) => (
              <Link key={creator.id} href={`/creators/${creator.id}`} className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 transition-colors hover:bg-accent/25">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{creator.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{creator.nextAction ?? "Set the next action."}</div>
                  </div>
                  <Badge variant="secondary" className="bg-muted text-foreground">
                    {getTierShortLabel(creator.tier)}
                  </Badge>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Clear desk. No creator needs your move right now.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="haus-panel">
        <CardContent className="p-4">
          <form action={addTask} className="grid gap-2 lg:grid-cols-[1fr_220px_160px_150px_auto]">
            <Input name="title" required placeholder="Add task..." />
            <Select name="creatorId" defaultValue="NONE">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No creator</SelectItem>
                {creators.map((creator) => (
                  <SelectItem key={creator.id} value={creator.id}>{creator.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input name="dueDate" type="date" />
            <Select name="priority" defaultValue="MEDIUM">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
              </SelectContent>
            </Select>
            <Button disabled={isPending}><Plus />Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={(value) => value && setFilter(value as TaskFilter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="TODAY">Today</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="bg-muted text-foreground">{openTasks.length} open</Badge>
        <Badge variant="secondary" className="bg-muted text-foreground">{completedTasks.length} completed</Badge>
        <Button variant="outline" className="ml-auto" render={<a href="/api/export?type=tasks-csv" />}>
          <Download />
          Export CSV
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent/30">
          <Upload className="size-4" />
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => importCsv(event.target.files?.[0])}
          />
        </label>
      </div>

      {visible.length === 0 && filter !== "COMPLETED" ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          Clear desk. No open tasks.
        </div>
      ) : null}

      <div className="grid gap-3">
        {visible.map((task) => (
          <Card key={task.id} className="haus-panel">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
              <div>
                <CardTitle className="text-base">{task.title}</CardTitle>
                <div className="mt-1 text-sm text-muted-foreground">
                  {task.creator ? (
                    <Link href={`/creators/${task.creator.id}`} className="hover:text-foreground">
                      {task.creator.name} · {task.creator.handle}
                    </Link>
                  ) : (
                    "General"
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-muted text-foreground">{task.priority}</Badge>
                <Select value={task.status} onValueChange={(value) => value && setStatus(task, value as TaskRecord["status"])}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">Todo</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(task)} aria-label={`Delete ${task.title}`}>
                  <Trash2 />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {task.details || "No detail"} {task.dueDate ? `· Due ${new Date(task.dueDate).toLocaleDateString()}` : ""}
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.title ?? "task"}?`}
        description="This task will be removed from the workspace."
        confirmLabel="Delete task"
        onConfirm={deleteTask}
      />
    </div>
  );
}
