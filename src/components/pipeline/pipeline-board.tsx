"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PIPELINE_STAGES } from "@/lib/domain";
import { cn } from "@/lib/utils";

type PipelineCreator = {
  id: string;
  name: string;
  handle: string;
  stage: (typeof PIPELINE_STAGES)[number]["value"];
  overallScore: number;
  niche?: string | null;
  priority: string;
};

export function PipelineBoard({ creators }: { creators: PipelineCreator[] }) {
  const [items, setItems] = useState(creators);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const byStage = useMemo(
    () =>
      Object.fromEntries(
        PIPELINE_STAGES.map((stage) => [stage.value, items.filter((creator) => creator.stage === stage.value)]),
      ) as Record<PipelineCreator["stage"], PipelineCreator[]>,
    [items],
  );

  async function onDragEnd(event: DragEndEvent) {
    const creatorId = String(event.active.id);
    const nextStage = event.over?.id as PipelineCreator["stage"] | undefined;
    const creator = items.find((item) => item.id === creatorId);

    if (!creator || !nextStage || creator.stage === nextStage) {
      return;
    }

    setItems((current) => current.map((item) => (item.id === creatorId ? { ...item, stage: nextStage } : item)));
    const response = await fetch(`/api/creators/${creatorId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: nextStage }),
    });

    if (!response.ok) {
      setItems(creators);
      toast.error("Stage update failed.");
      return;
    }

    const result = await response.json();
    toast.success(result.task ? `Moved and created: ${result.task.title}` : "Stage updated.");
    if (result.suggestion) {
      toast.message(`Suggested next stage: ${result.suggestion}`);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid auto-cols-[300px] grid-flow-col gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <PipelineColumn key={stage.value} id={stage.value} label={stage.label} count={byStage[stage.value].length}>
            {byStage[stage.value].map((creator) => (
              <PipelineCard key={creator.id} creator={creator} />
            ))}
          </PipelineColumn>
        ))}
      </div>
    </DndContext>
  );
}

function PipelineColumn({
  id,
  label,
  count,
  children,
}: {
  id: PipelineCreator["stage"];
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section ref={setNodeRef} className={cn("min-h-[72vh] rounded-md border bg-muted/35 p-3", isOver && "border-ring bg-accent/30")}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function PipelineCard({ creator }: { creator: PipelineCreator }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: creator.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab rounded-md shadow-sm active:cursor-grabbing", isDragging && "opacity-60")}
    >
      <CardContent className="p-3">
        <Link href={`/creators/${creator.id}`} className="block">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{creator.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{creator.handle}</div>
            </div>
            <div className="font-mono text-lg">{creator.overallScore.toFixed(1)}</div>
          </div>
          <div className="mt-3 line-clamp-2 text-sm text-muted-foreground">{creator.niche ?? "No niche yet"}</div>
          <Badge className="mt-3" variant={creator.priority === "HIGH" ? "default" : "secondary"}>
            {creator.priority.toLowerCase()}
          </Badge>
        </Link>
      </CardContent>
    </Card>
  );
}
