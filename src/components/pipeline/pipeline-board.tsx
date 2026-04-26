"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/app/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreatorAvatar, PriorityBadge, StageBadge } from "@/components/creators/creator-identity";
import { PIPELINE_STAGES } from "@/lib/domain";
import { cn } from "@/lib/utils";

type PipelineCreator = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  stage: (typeof PIPELINE_STAGES)[number]["value"];
  overallScore: number;
  profileImageUrl?: string | null;
  niche?: string | null;
  nextAction?: string | null;
  tags: string[];
  priority: "LOW" | "MEDIUM" | "HIGH";
};

export function PipelineBoard({ creators }: { creators: PipelineCreator[] }) {
  const [items, setItems] = useState(creators);
  const [deleteTarget, setDeleteTarget] = useState<PipelineCreator | null>(null);
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

  async function deleteCreator() {
    if (!deleteTarget) {
      return;
    }

    const response = await fetch(`/api/creators/${deleteTarget.id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Creator could not be deleted.");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
    toast.success("Creator deleted.");
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid auto-cols-[300px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <PipelineColumn key={stage.value} id={stage.value} label={stage.label} count={byStage[stage.value].length}>
              {byStage[stage.value].map((creator) => (
                <PipelineCard key={creator.id} creator={creator} onDelete={() => setDeleteTarget(creator)} />
              ))}
            </PipelineColumn>
          ))}
        </div>
      </DndContext>
      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "creator"}?`}
        description="This removes the creator and related tasks from the workspace."
        confirmLabel="Delete creator"
        onConfirm={deleteCreator}
      />
    </>
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

function PipelineCard({ creator, onDelete }: { creator: PipelineCreator; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: creator.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab rounded-lg shadow-sm transition-colors hover:bg-accent/25 active:cursor-grabbing", isDragging && "opacity-60")}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/creators/${creator.id}`} className="block min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <CreatorAvatar creator={creator} size="sm" />
              <div className="min-w-0">
                <div className="truncate font-medium">{creator.name}</div>
                <div className="text-xs text-muted-foreground">{creator.handle}</div>
              </div>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 />
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StageBadge stage={creator.stage} />
          <PriorityBadge priority={creator.priority} />
          {creator.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="bg-muted text-foreground">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {creator.nextAction || "Set the next action"}
          </div>
          <div className="shrink-0 pl-3 text-right">
            <div className="font-mono text-lg">{creator.overallScore.toFixed(1)}</div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">fit</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
