"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/app/confirm-action";
import {
  describeCurrentStatus,
  ExactStepValue,
  EXACT_STEP_OPTIONS_BY_LANE,
  getDefaultExactStepForLane,
  getExactStepLabel,
  getExactStepTemplateName,
  getGroupedPipelineLane,
  getLegacyExactStepFromStage,
  getQuickAction,
  getTierShortLabel,
  isExactStepValue,
  WORKFLOW_LANES,
} from "@/lib/creator-command-center";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatorAvatar, PriorityBadge } from "@/components/creators/creator-identity";
import { cn } from "@/lib/utils";

type PipelineCreator = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  stage: "SOURCED" | "VETTED" | "INVITED" | "REPLIED" | "QUALIFIED" | "SAMPLE_SENT" | "BRIEF_SENT" | "CONTENT_LIVE" | "EVALUATED" | "EXPANDED" | "AMBASSADOR";
  overallScore: number;
  profileImageUrl: string | null;
  niche: string | null;
  nextAction: string | null;
  projectType: string | null;
  collabAngle: string | null;
  tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  exactStep: string | null;
  bossApprovalStatus: "NEEDS_APPROVAL" | "WAITING" | "APPROVED" | "DECLINED" | null;
  sampleStatus: "PENDING" | "SENT" | "DELIVERED" | null;
  briefStatus: "DRAFT" | "SENT" | "ACCEPTED" | null;
  usageRightsStatus: "PENDING" | "CONFIRMED" | null;
  adPotential: "LOW" | "MEDIUM" | "HIGH" | null;
  tags: string[];
  priority: "LOW" | "MEDIUM" | "HIGH";
};

export function PipelineBoard({ creators }: { creators: PipelineCreator[] }) {
  const [items, setItems] = useState(creators.map(normalizeCreator));
  const [deleteTarget, setDeleteTarget] = useState<PipelineCreator | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byLane = useMemo(
    () =>
      Object.fromEntries(
        WORKFLOW_LANES.map((lane) => [lane.id, items.filter((creator) => getGroupedPipelineLane(creator.stage, creator.exactStep) === lane.id)]),
      ) as Record<(typeof WORKFLOW_LANES)[number]["id"], ReturnType<typeof normalizeCreator>[]>,
    [items],
  );

  async function onDragEnd(event: DragEndEvent) {
    const creatorId = String(event.active.id);
    const lane = event.over?.id as (typeof WORKFLOW_LANES)[number]["id"] | undefined;
    const creator = items.find((item) => item.id === creatorId);

    if (!creator || !lane) {
      return;
    }

    const exactStep = getDefaultExactStepForLane(lane, creator);
    await persistWorkflowChange(creator.id, { lane, exactStep }, items, setItems);
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
        <div className="grid gap-4 xl:grid-cols-4">
          {WORKFLOW_LANES.map((lane) => (
            <PipelineColumn key={lane.id} id={lane.id} label={lane.label} note={lane.note} count={byLane[lane.id].length}>
              {byLane[lane.id].map((creator) => (
                <PipelineCard
                  key={creator.id}
                  creator={creator}
                  onDelete={() => setDeleteTarget(creator)}
                  onChangeExactStep={(exactStep) => persistWorkflowChange(creator.id, { exactStep }, items, setItems)}
                />
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
  children,
}: {
  id: (typeof WORKFLOW_LANES)[number]["id"];
  label: string;
  note: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const laneSteps = EXACT_STEP_OPTIONS_BY_LANE.find((lane) => lane.id === id)?.steps ?? [];

  return (
    <section
      ref={setNodeRef}
      className={cn("min-h-[66vh] rounded-2xl border bg-muted/35 p-3", isOver && "border-ring bg-accent/20")}
    >
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">{label}</div>
          <Badge variant="outline">{count}</Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{note}</div>
        <div className="mt-3 flex flex-wrap gap-1">
          {laneSteps.map((step) => (
            <Badge key={step.value} variant="secondary" className="bg-background/60 text-muted-foreground">
              {step.label}
            </Badge>
          ))}
        </div>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function PipelineCard({
  creator,
  onDelete,
  onChangeExactStep,
}: {
  creator: ReturnType<typeof normalizeCreator>;
  onDelete: () => void;
  onChangeExactStep: (exactStep: ExactStepValue) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: creator.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const templateName = getExactStepTemplateName(creator.exactStep);
  const quickAction = getQuickAction(creator.exactStep);

  return (
    <Card ref={setNodeRef} style={style} className={cn("rounded-xl shadow-sm transition-colors hover:bg-accent/15", isDragging && "opacity-60")}>
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

        <div className="mt-3 text-sm text-muted-foreground">
          {creator.collabAngle || creator.nextAction || "Every creator should have one clear next action."}
        </div>

        <div className="mt-3 grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Exact step</div>
              <Select value={creator.exactStep ?? ""} onValueChange={(value) => value && onChangeExactStep(value as ExactStepValue)}>
                <SelectTrigger size="sm" className="mt-1 w-full">
                  <SelectValue placeholder="Choose exact step" />
                </SelectTrigger>
                <SelectContent align="start">
                  {EXACT_STEP_OPTIONS_BY_LANE.map((lane, index) => (
                    <div key={lane.id}>
                      <SelectGroup>
                        <SelectLabel>{lane.label}</SelectLabel>
                        {lane.steps.map((step) => (
                          <SelectItem key={step.value} value={step.value}>
                            {step.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {index < EXACT_STEP_OPTIONS_BY_LANE.length - 1 ? <SelectSeparator /> : null}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-lg">{creator.overallScore.toFixed(1)}</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">fit</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/55 px-3 py-2 text-sm">
            {getExactStepLabel(creator.exactStep)}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {templateName ? (
            <Button size="sm" variant="outline" render={<Link href={`/templates?template=${encodeURIComponent(templateName)}`} />}>
              Open matching template
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" render={<Link href={`/creators/${creator.id}`} />}>
            Open creator
          </Button>
          {quickAction ? (
            <Button size="sm" variant="outline" onClick={() => onChangeExactStep(quickAction.exactStep)}>
              {quickAction.label}
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{describeCurrentStatus(creator.stage, creator.exactStep)}</span>
          <Link href={`/creators/${creator.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
            Open creator <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

async function persistWorkflowChange(
  creatorId: string,
  payload: { exactStep?: ExactStepValue; lane?: (typeof WORKFLOW_LANES)[number]["id"] },
  currentItems: ReturnType<typeof normalizeCreator>[],
  setItems: React.Dispatch<React.SetStateAction<ReturnType<typeof normalizeCreator>[]>>,
) {
  const current = currentItems.find((item) => item.id === creatorId);

  if (!current) {
    return;
  }

  const optimisticExactStep = payload.exactStep ?? getDefaultExactStepForLane(payload.lane ?? getGroupedPipelineLane(current.stage, current.exactStep), current);
  const response = await fetch(`/api/creators/${creatorId}/stage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exactStep: optimisticExactStep,
      lane: payload.lane,
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    toast.error(result?.error ?? "Stage update failed.");
    return;
  }

  setItems((items) =>
    items.map((creator) =>
      creator.id === creatorId
        ? normalizeCreator({
            ...creator,
            stage: result?.creator?.stage ?? creator.stage,
            exactStep: result?.exactStep ?? optimisticExactStep,
            nextAction: result?.creator?.nextAction ?? creator.nextAction,
            bossApprovalStatus: result?.creator?.bossApprovalStatus ?? creator.bossApprovalStatus,
            sampleStatus: result?.creator?.sampleStatus ?? creator.sampleStatus,
            briefStatus: result?.creator?.briefStatus ?? creator.briefStatus,
            usageRightsStatus: result?.creator?.usageRightsStatus ?? creator.usageRightsStatus,
            adPotential: result?.creator?.adPotential ?? creator.adPotential,
          })
        : creator,
    ),
  );

  toast.success("Workflow updated.");
  if (result?.schemaWarning) {
    toast.message(result.schemaWarning);
  }
}

function normalizeCreator(creator: PipelineCreator) {
  return {
    ...creator,
    exactStep: isExactStepValue(creator.exactStep)
      ? creator.exactStep
      : getLegacyExactStepFromStage(creator.stage, creator.nextAction, creator.tier ?? null),
  };
}
