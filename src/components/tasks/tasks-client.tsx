"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
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
};

export function TasksClient({ tasks, creators }: { tasks: TaskRecord[]; creators: CreatorOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("OPEN");

  const visible = tasks.filter((task) => (filter === "OPEN" ? task.status !== "DONE" : filter === "ALL" || task.status === filter));

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

      if (response.ok) {
        toast.success("Task added.");
        router.refresh();
      }
    });
  }

  function setStatus(task: TaskRecord, status: TaskRecord["status"]) {
    startTransition(async () => {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5">
      <Card className="haus-panel">
        <CardContent className="p-4">
          <form action={addTask} className="grid grid-cols-[1fr_220px_160px_150px_auto] gap-2">
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

      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={(value) => value && setFilter(value)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="TODO">Todo</SelectItem>
            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="ml-auto" render={<a href="/api/export?type=tasks-csv" />}>
          <Download />
          Tasks CSV
        </Button>
      </div>

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
                <Badge variant={task.priority === "HIGH" ? "default" : "secondary"}>{task.priority}</Badge>
                <Select value={task.status} onValueChange={(value) => value && setStatus(task, value as TaskRecord["status"])}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">Todo</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {task.details || "No detail"} {task.dueDate ? `· Due ${new Date(task.dueDate).toLocaleDateString()}` : ""}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
