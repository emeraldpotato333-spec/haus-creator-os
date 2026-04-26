"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Copy, ExternalLink, ListChecks, MessageSquareText, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/app/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CreatorAvatar,
  CreatorMetaBadges,
  PlatformLabel,
  PriorityBadge,
  ScorePill,
  StageBadge,
  creatorFitLine,
} from "@/components/creators/creator-identity";
import { PIPELINE_STAGES, SCORE_FIELDS, calculateOverallScore, evaluationSuggestion, formatMoney, stageLabel } from "@/lib/domain";

type CreatorDetail = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  profileUrl?: string | null;
  profileImageUrl?: string | null;
  email?: string | null;
  location?: string | null;
  niche?: string | null;
  source?: string | null;
  audienceSummary?: string | null;
  whyFit?: string | null;
  nextAction?: string | null;
  notes: string;
  tags: string[];
  followers?: number | null;
  engagementRate?: number | null;
  estimatedReach?: number | null;
  contentLiveUrl?: string | null;
  affiliateCode?: string | null;
  conversions: number;
  revenueCents: number;
  stage: (typeof PIPELINE_STAGES)[number]["value"];
  lastContactedAt?: string | Date | null;
  nextFollowUpAt?: string | Date | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  visualFitScore: number;
  commercialFitScore: number;
  contentQuality: number;
  trustPurchaseIntentScore: number;
  overallScoreOverride?: number | null;
  overallScore: number;
  updatedAt?: string | Date;
  stageChangedAt?: string | Date;
  interactions: { id: string; type: string; title: string; body: string; happenedAt: string | Date }[];
  tasks: { id: string; title: string; details: string; status: string; dueDate?: string | Date | null; priority: string }[];
  briefs: { id: string; title: string; body: string; status: string; dueDate?: string | Date | null }[];
  linkedTemplates: { id: string; template: TemplateRecord }[];
};

type TemplateRecord = {
  id: string;
  name: string;
  category: string;
  subject?: string | null;
  body: string;
};

type SaveState = "saved" | "saving" | "dirty" | "failed";
type TaskStatus = CreatorDetail["tasks"][number]["status"];

type CreatorWritePayload = Pick<
  CreatorDetail,
  | "name"
  | "handle"
  | "platform"
  | "profileUrl"
  | "profileImageUrl"
  | "email"
  | "location"
  | "niche"
  | "source"
  | "audienceSummary"
  | "whyFit"
  | "nextAction"
  | "notes"
  | "tags"
  | "followers"
  | "engagementRate"
  | "estimatedReach"
  | "contentLiveUrl"
  | "affiliateCode"
  | "conversions"
  | "revenueCents"
  | "stage"
  | "lastContactedAt"
  | "nextFollowUpAt"
  | "priority"
  | "visualFitScore"
  | "commercialFitScore"
  | "contentQuality"
  | "trustPurchaseIntentScore"
  | "overallScoreOverride"
>;

type CreatorWriteKey = keyof CreatorWritePayload;

const CREATOR_WRITE_KEYS = new Set<keyof CreatorDetail>([
  "name",
  "handle",
  "platform",
  "profileUrl",
  "profileImageUrl",
  "email",
  "location",
  "niche",
  "source",
  "audienceSummary",
  "whyFit",
  "nextAction",
  "notes",
  "tags",
  "followers",
  "engagementRate",
  "estimatedReach",
  "contentLiveUrl",
  "affiliateCode",
  "conversions",
  "revenueCents",
  "stage",
  "lastContactedAt",
  "nextFollowUpAt",
  "priority",
  "visualFitScore",
  "commercialFitScore",
  "contentQuality",
  "trustPurchaseIntentScore",
  "overallScoreOverride",
]);

const NULLABLE_TEXT_KEYS = new Set<CreatorWriteKey>([
  "profileUrl",
  "profileImageUrl",
  "email",
  "location",
  "niche",
  "source",
  "audienceSummary",
  "whyFit",
  "nextAction",
  "contentLiveUrl",
  "affiliateCode",
]);

const OPTIONAL_NUMBER_KEYS = new Set<CreatorWriteKey>(["followers", "engagementRate", "estimatedReach", "overallScoreOverride"]);
const OPTIONAL_DATE_KEYS = new Set<CreatorWriteKey>(["lastContactedAt", "nextFollowUpAt"]);

export function CreatorDetailClient({
  initialCreator,
  templates,
}: {
  initialCreator: CreatorDetail;
  templates: TemplateRecord[];
}) {
  const router = useRouter();
  const [creator, setCreator] = useState(initialCreator);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autosaveNonce, setAutosaveNonce] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<CreatorDetail["tasks"][number] | null>(null);
  const dirtyRef = useRef(false);
  const isSavingRef = useRef(false);
  const pendingPatchRef = useRef<Partial<CreatorWritePayload>>({});

  const score = useMemo(
    () =>
      calculateOverallScore({
        visualFitScore: creator.visualFitScore,
        commercialFitScore: creator.commercialFitScore,
        contentQuality: creator.contentQuality,
        trustPurchaseIntentScore: creator.trustPurchaseIntentScore,
      }, creator.overallScoreOverride),
    [creator],
  );
  const suggestion = evaluationSuggestion(creator.stage, score);
  const nextOpenTask = creator.tasks.find((task) => task.status !== "DONE");
  const lastUpdated = creator.updatedAt ? new Date(creator.updatedAt).toLocaleDateString() : "Not saved yet";
  const fitLine = creatorFitLine({ ...creator, overallScore: score });

  useEffect(() => {
    if (!Object.keys(pendingPatchRef.current).length) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      if (isSavingRef.current) {
        return;
      }

      const patch = pendingPatchRef.current;
      pendingPatchRef.current = {};
      isSavingRef.current = true;
      setSaveState("saving");
      setSaveError(null);
      let failed = false;

      try {
        const response = await fetch(`/api/creators/${creator.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(getAutosaveError(result, response.status));
        }

        setCreator((current) => ({ ...current, overallScore: result?.overallScore ?? current.overallScore }));

        if (result?.automationWarning) {
          toast.message(result.automationWarning);
        }
      } catch (error) {
        failed = true;
        const reason = error instanceof Error ? error.message : "The update could not be saved.";
        const hasQueuedChanges = Object.keys(pendingPatchRef.current).length > 0;
        pendingPatchRef.current = { ...patch, ...pendingPatchRef.current };
        setSaveError(reason);
        toast.error(`Autosave failed: ${reason}`);
        if (hasQueuedChanges) {
          setSaveState("dirty");
          setAutosaveNonce((current) => current + 1);
        } else {
          setSaveState("failed");
        }
      } finally {
        isSavingRef.current = false;

        if (!failed && Object.keys(pendingPatchRef.current).length) {
          setSaveState("dirty");
          setAutosaveNonce((current) => current + 1);
          return;
        }

        if (!failed) {
          setSaveState("saved");
          dirtyRef.current = false;
          router.refresh();
        }
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [autosaveNonce, creator.id, router]);

  function update<K extends keyof CreatorDetail>(key: K, value: CreatorDetail[K]) {
    dirtyRef.current = true;
    if (isCreatorWriteKey(key)) {
      pendingPatchRef.current = {
        ...pendingPatchRef.current,
        [key]: normalizePatchValue(key, value as CreatorDetail[CreatorWriteKey]),
      };
    }
    setSaveState("dirty");
    setSaveError(null);
    setAutosaveNonce((current) => current + 1);
    setCreator((current) => ({ ...current, [key]: value }));
  }

  function addTask(formData: FormData) {
    startTransition(async () => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: creator.id,
          title: formData.get("title"),
          dueDate: formData.get("dueDate"),
          priority: formData.get("priority") || "MEDIUM",
        }),
      });
      if (response.ok) {
        const task = await response.json();
        setCreator((current) => ({
          ...current,
          tasks: [task, ...current.tasks],
        }));
        toast.success("Task added.");
        return;
      }

      toast.error("Task could not be added.");
    });
  }

  function addInteraction(formData: FormData) {
    startTransition(async () => {
      const response = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: creator.id,
          title: formData.get("title"),
          body: formData.get("body"),
          type: "NOTE",
        }),
      });
      if (response.ok) {
        const interaction = await response.json();
        setCreator((current) => ({
          ...current,
          interactions: [interaction, ...current.interactions],
        }));
        toast.success("Note added.");
        return;
      }

      toast.error("Note could not be added.");
    });
  }

  function setTaskStatus(taskId: string, status: TaskStatus) {
    startTransition(async () => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        toast.error("Task status could not be updated.");
        return;
      }

      const updated = await response.json();
      setCreator((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...updated } : task)),
      }));
    });
  }

  async function deleteTask() {
    if (!deleteTaskTarget) {
      return;
    }

    const response = await fetch(`/api/tasks/${deleteTaskTarget.id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Task could not be deleted.");
      return;
    }

    setCreator((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== deleteTaskTarget.id),
    }));
    setDeleteTaskTarget(null);
    toast.success("Task deleted.");
  }

  async function deleteCreator() {
    const response = await fetch(`/api/creators/${creator.id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Creator could not be deleted.");
      return;
    }

    toast.success("Creator deleted.");
    router.push("/creators");
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid gap-6">
        <Card className="haus-panel">
          <CardContent className="grid gap-5 p-5">
            <div className="flex items-start justify-between gap-6">
              <div className="grid flex-1 gap-4">
                <div className="flex items-start gap-4">
                  <CreatorAvatar creator={creator} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Identity / summary
                    </div>
                    <Input value={creator.name} onChange={(event) => update("name", event.target.value)} className="mt-1 h-12 border-0 bg-transparent px-0 text-3xl font-semibold shadow-none focus-visible:ring-0" />
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <Input value={creator.handle} onChange={(event) => update("handle", event.target.value)} className="h-8 w-44" />
                      <Input value={creator.platform} onChange={(event) => update("platform", event.target.value)} className="h-8 w-36" />
                      {creator.platform ? <PlatformLabel platform={creator.platform} /> : null}
                      {creator.profileUrl ? (
                        <a href={creator.profileUrl} target="_blank" className="flex items-center gap-1 hover:text-foreground">
                          Profile <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
                <CreatorMetaBadges creator={{ ...creator, overallScore: score }} />
                <div className="rounded-lg border bg-background/50 p-3 text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">Next action:</span> {creator.nextAction || fitLine}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-5xl">{score.toFixed(1)}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">overall</div>
                <Badge className="mt-3 capitalize" variant={saveState === "failed" ? "destructive" : saveState === "saved" ? "secondary" : "outline"}>
                  {saveState === "failed" ? (
                    <AlertCircle className="size-3" />
                  ) : saveState === "saving" ? (
                    <Save className="size-3" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  {saveState}
                </Badge>
                {saveError ? (
                  <div className="mt-2 max-w-64 text-xs leading-5 text-destructive">
                    Autosave failed: {saveError}
                  </div>
                ) : null}
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => setDeleteOpen(true)}>
                  <Trash2 />
                  Delete creator
                </Button>
              </div>
            </div>

            {suggestion ? (
              <div className="rounded-md border bg-accent/35 p-4 text-sm">
                Score is strong enough to suggest <span className="font-medium">{suggestion}</span>.
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-4">
              <Field label="Niche" value={creator.niche ?? ""} onChange={(value) => update("niche", value)} />
              <Field label="Location" value={creator.location ?? ""} onChange={(value) => update("location", value)} />
              <Field label="Source" value={creator.source ?? ""} onChange={(value) => update("source", value)} />
            </div>
            <div className="grid gap-2">
              <Label>Audience notes</Label>
              <Textarea value={creator.audienceSummary ?? ""} onChange={(event) => update("audienceSummary", event.target.value)} className="min-h-24" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Profile image URL" value={creator.profileImageUrl ?? ""} onChange={(value) => update("profileImageUrl", value)} />
              <Field label="Profile URL" value={creator.profileUrl ?? ""} onChange={(value) => update("profileUrl", value)} />
            </div>
            <div className="grid gap-2">
              <Label>Next action</Label>
              <Textarea value={creator.nextAction ?? ""} onChange={(event) => update("nextAction", event.target.value)} className="min-h-24" />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="notes" className="grid gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="interactions">Activity</TabsTrigger>
            <TabsTrigger value="briefs">Briefs</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="notes">
            <Card className="haus-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="size-4" />
                  Working notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={creator.notes} onChange={(event) => update("notes", event.target.value)} className="min-h-72 text-base leading-7" placeholder="Drop sourcing notes, objections, creative angles, and next moves here." />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tasks">
            <Card className="haus-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="size-4" />
                  Next actions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <form action={addTask} className="flex gap-2">
                  <Input name="title" required placeholder="Add a task..." />
                  <Input name="dueDate" type="date" className="w-44" />
                  <Select name="priority" defaultValue="MEDIUM">
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button disabled={isPending}><Plus />Add</Button>
                </form>
                {creator.tasks.map((task) => (
                  <div key={task.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{task.title}</div>
                      <div className="flex items-center gap-2">
                        <Select value={task.status} onValueChange={(value) => value && setTaskStatus(task.id, value as TaskStatus)}>
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TODO">Todo</SelectItem>
                            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                            <SelectItem value="DONE">Done</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTaskTarget(task)} aria-label={`Delete ${task.title}`}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}
                    </div>
                  </div>
                ))}
                {creator.tasks.length === 0 ? <EmptyLine text="Clear desk. No open tasks." /> : null}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="interactions">
            <Card className="haus-panel">
              <CardHeader><CardTitle>Interactions</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <form action={addInteraction} className="grid gap-2">
                  <Input name="title" required placeholder="Interaction title" />
                  <Textarea name="body" placeholder="What happened?" />
                  <Button className="w-fit" disabled={isPending}><Plus />Add note</Button>
                </form>
                <Separator />
                {creator.interactions.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{item.title}</div>
                      <Badge variant="outline">{item.type}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                ))}
                {creator.interactions.length === 0 ? <EmptyLine text="No notes yet." /> : null}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="briefs">
            <Card className="haus-panel">
              <CardHeader><CardTitle>Briefs</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {creator.briefs.map((brief) => (
                  <div key={brief.id} className="rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{brief.title}</div>
                      <Badge>{brief.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{brief.body}</p>
                  </div>
                ))}
                {creator.briefs.length === 0 ? <EmptyLine text="No briefs yet. Use a starter template when this creator is ready." /> : null}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="templates">
            <Card className="haus-panel">
              <CardHeader><CardTitle>Linked and recommended templates</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {[...creator.linkedTemplates.map((link) => link.template), ...templates.slice(0, 5)].map((template) => (
                  <div key={template.id} className="rounded-md border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground">{template.subject}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(template.body)}>
                        <Copy /> Copy
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <aside className="grid h-fit gap-4">
        <Card className="haus-panel">
          <CardHeader>
            <CardTitle>Operator summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-1.5">
              <StageBadge stage={creator.stage} />
              <PriorityBadge priority={creator.priority} />
              <ScorePill score={score} />
            </div>
            <div className="grid gap-3 rounded-lg border bg-background/60 p-3">
              <SummaryRow label="Current stage" value={stageLabel(creator.stage)} />
              <SummaryRow label="Last updated" value={lastUpdated} />
              <SummaryRow label="Last contacted" value={creator.lastContactedAt ? new Date(creator.lastContactedAt).toLocaleDateString() : "Not set"} />
              <SummaryRow label="Next follow-up" value={creator.nextFollowUpAt ? new Date(creator.nextFollowUpAt).toLocaleDateString() : "Not set"} />
              <SummaryRow label="High-fit read" value={score >= 8 ? "Yes, worth momentum" : "Needs more signal"} />
            </div>
            <div className="rounded-lg border border-accent/40 bg-accent/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ArrowRight className="size-4" />
                What happens next
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {nextOpenTask?.title ?? creator.nextAction ?? "Add the next action so this record has a clear owner and direction."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="haus-panel">
          <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Select value={creator.stage} onValueChange={(value) => value && update("stage", value as CreatorDetail["stage"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={creator.priority} onValueChange={(value) => value && update("priority", value as CreatorDetail["priority"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low priority</SelectItem>
                <SelectItem value="MEDIUM">Medium priority</SelectItem>
                <SelectItem value="HIGH">High priority</SelectItem>
              </SelectContent>
            </Select>
            <Field
              label="Last contacted"
              type="date"
              value={creator.lastContactedAt ? new Date(creator.lastContactedAt).toISOString().slice(0, 10) : ""}
              onChange={(value) => update("lastContactedAt", value || null)}
            />
            <Field
              label="Next follow-up"
              type="date"
              value={creator.nextFollowUpAt ? new Date(creator.nextFollowUpAt).toISOString().slice(0, 10) : ""}
              onChange={(value) => update("nextFollowUpAt", value || null)}
            />
            <div className="text-sm text-muted-foreground">Current stage: {stageLabel(creator.stage)}</div>
          </CardContent>
        </Card>

        <Card className="haus-panel">
          <CardHeader><CardTitle>Scorecard</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {SCORE_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1">
                <div className="flex items-center justify-between text-sm">
                  <Label>{field.label}</Label>
                  <span className="font-mono">{creator[field.key]}</span>
                </div>
                <Input
                  type="range"
                  min={0}
                  max={10}
                  value={creator[field.key]}
                  onChange={(event) => update(field.key, Number(event.target.value))}
                />
              </label>
            ))}
            <Field
              label="Overall override"
              type="number"
              value={creator.overallScoreOverride != null ? String(creator.overallScoreOverride) : ""}
              onChange={(value) => update("overallScoreOverride", value ? Number(value) : null)}
            />
          </CardContent>
        </Card>

        <Card className="haus-panel">
          <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Live URL" value={creator.contentLiveUrl ?? ""} onChange={(value) => update("contentLiveUrl", value)} />
            <Field label="Affiliate code" value={creator.affiliateCode ?? ""} onChange={(value) => update("affiliateCode", value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Conversions" type="number" value={String(creator.conversions)} onChange={(value) => update("conversions", Number(value || 0))} />
              <Field label="Revenue cents" type="number" value={String(creator.revenueCents)} onChange={(value) => update("revenueCents", Number(value || 0))} />
            </div>
            <div className="rounded-md border bg-background/60 p-3 text-sm">
              Tracked value: <span className="font-medium">{formatMoney(creator.revenueCents)}</span>
            </div>
          </CardContent>
        </Card>
      </aside>
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${creator.name}?`}
        description="This removes the creator and related tasks from the workspace."
        confirmLabel="Delete creator"
        onConfirm={deleteCreator}
      />
      <ConfirmActionDialog
        open={Boolean(deleteTaskTarget)}
        onOpenChange={(open) => !open && setDeleteTaskTarget(null)}
        title={`Delete ${deleteTaskTarget?.title ?? "task"}?`}
        description="This task will be removed from the creator record."
        confirmLabel="Delete task"
        onConfirm={deleteTask}
      />
    </div>
  );
}

function isCreatorWriteKey(key: keyof CreatorDetail): key is CreatorWriteKey {
  return CREATOR_WRITE_KEYS.has(key);
}

function normalizePatchValue(key: CreatorWriteKey, value: CreatorDetail[CreatorWriteKey]) {
  if (NULLABLE_TEXT_KEYS.has(key)) {
    if (typeof value !== "string") {
      return value ?? null;
    }

    return value.trim() ? value.trim() : null;
  }

  if (OPTIONAL_NUMBER_KEYS.has(key)) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  if (OPTIONAL_DATE_KEYS.has(key)) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return typeof value === "string" ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  return value;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as { error?: string; overallScore?: number; automationWarning?: string };
  } catch {
    return null;
  }
}

function getAutosaveError(result: { error?: string } | null, status: number) {
  if (result?.error) {
    return result.error;
  }

  if (status === 409) {
    return "Another creator already uses that platform and handle.";
  }

  if (status >= 500) {
    return "Server error while saving. Check Vercel logs for the creator update route.";
  }

  return "The update could not be saved.";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
