"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { ArrowRight, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/app/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreatorAvatar, PriorityBadge, StageBadge } from "@/components/creators/creator-identity";
import { PIPELINE_STAGES } from "@/lib/domain";
import { getGroupedPipelineLane, getTierShortLabel, GROUPED_PIPELINE_LANES } from "@/lib/creator-command-center";
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
  projectType?: string | null;
  collabAngle?: string | null;
  tier?: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
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
        GROUPED_PIPELINE_LANES.map((lane) => [lane.id, items.filter((creator) => getGroupedPipelineLane(creator.stage) === lane.id)]),
      ) as Record<(typeof GROUPED_PIPELINE_LANES)[number]["id"], PipelineCreator[]>,
    [items],
  );

  async function onDragEnd(event: DragEndEvent) {
    const creatorId = String(event.active.id);
    const nextLane = event.over?.id as (typeof GROUPED_PIPELINE_LANES)[number]["id"] | undefined;
    const creator = items.find((item) => item.id === creatorId);

    if (!creator || !nextLane) {
      return;
    }

    const lane = GROUPED_PIPELINE_LANES.find((entry) => entry.id === nextLane);
    const nextStage = lane?.stages[0];

    if (!nextStage || creator.stage === nextStage) {
      return;
    }

    setItems((current) => current.map((item) => (item.id === creatorId ? { ...item, stage: nextStage } : item)));
    await persistStageChange(creatorId, nextStage, creators, setItems);
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

  async function setCreatorStage(creatorId: string, stage: PipelineCreator["stage"]) {
    setItems((current) => current.map((item) => (item.id === creatorId ? { ...item, stage } : item)));
    await persistStageChange(creatorId, stage, creators, setItems);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-4 xl:grid-cols-4">
          {GROUPED_PIPELINE_LANES.map((lane) => (
            <PipelineColumn key={lane.id} id={lane.id} label={lane.label} note={lane.note} count={byStage[lane.id].length} stages={lane.stages}>
              {byStage[lane.id].map((creator) => (
                <PipelineCard key={creator.id} creator={creator} onDelete={() => setDeleteTarget(creator)} onSetStage={setCreatorStage} />
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
  note,
  count,
  stages,
  children,
}: {
  id: (typeof GROUPED_PIPELINE_LANES)[number]["id"];
  label: string;
  note: string;
  count: number;
  stages: PipelineCreator["stage"][];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section ref={setNodeRef} className={cn("min-h-[66vh] rounded-2xl border bg-muted/35 p-3", isOver && "border-ring bg-accent/30")}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{note}</div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {stages.map((stage) => PIPELINE_STAGES.find((item) => item.value === stage)?.label ?? stage).join(" · ")}
          </div>
        </div>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function PipelineCard({
  creator,
  onDelete,
  onSetStage,
}: {
  creator: PipelineCreator;
  onDelete: () => void;
  onSetStage: (creatorId: string, stage: PipelineCreator["stage"]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: creator.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const lane = GROUPED_PIPELINE_LANES.find((entry) => entry.id === getGroupedPipelineLane(creator.stage)) ?? GROUPED_PIPELINE_LANES[0];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("rounded-xl shadow-sm transition-colors hover:bg-accent/25", isDragging && "opacity-60")}
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
          <div className="flex items-center gap-1">
            <button
              {...listeners}
              {...attributes}
              className="inline-flex size-7 cursor-grab items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-accent/30 active:cursor-grabbing"
              aria-label={`Drag ${creator.name}`}
            >
              <GripVertical className="size-3.5" />
            </button>
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
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="bg-muted text-foreground">
            {getTierShortLabel(creator.tier)}
          </Badge>
          <PriorityBadge priority={creator.priority} />
          {creator.projectType ? <Badge variant="outline">{creator.projectType}</Badge> : null}
        </div>
        <div className="mt-3 grid gap-3">
          <div className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {creator.nextAction || creator.collabAngle || "Set the next action"}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Exact step</div>
              <Select value={creator.stage} onValueChange={(value) => onSetStage(creator.id, value as PipelineCreator["stage"])}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lane.stages.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {PIPELINE_STAGES.find((item) => item.value === stage)?.label ?? stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="shrink-0 pl-3 text-right">
              <div className="font-mono text-lg">{creator.overallScore.toFixed(1)}</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">fit</div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <StageBadge stage={creator.stage} />
          <Link href={`/creators/${creator.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
            Open creator <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

async function persistStageChange(
  creatorId: string,
  nextStage: PipelineCreator["stage"],
  creators: PipelineCreator[],
  setItems: React.Dispatch<React.SetStateAction<PipelineCreator[]>>,
) {
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
