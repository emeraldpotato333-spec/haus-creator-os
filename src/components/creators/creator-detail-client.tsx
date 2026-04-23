"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PIPELINE_STAGES, SCORE_FIELDS, calculateOverallScore, evaluationSuggestion, formatMoney, stageLabel } from "@/lib/domain";

type CreatorDetail = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  profileUrl?: string | null;
  email?: string | null;
  location?: string | null;
  niche?: string | null;
  source?: string | null;
  audienceSummary?: string | null;
  whyFit?: string | null;
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
  priority: "LOW" | "MEDIUM" | "HIGH";
  audienceFit: number;
  contentQuality: number;
  aestheticFit: number;
  authorityTrust: number;
  logisticsFit: number;
  purchaseIntent: number;
  overallScore: number;
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

export function CreatorDetailClient({
  initialCreator,
  templates,
}: {
  initialCreator: CreatorDetail;
  templates: TemplateRecord[];
}) {
  const router = useRouter();
  const [creator, setCreator] = useState(initialCreator);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [isPending, startTransition] = useTransition();
  const dirtyRef = useRef(false);

  const score = useMemo(
    () =>
      calculateOverallScore({
        audienceFit: creator.audienceFit,
        contentQuality: creator.contentQuality,
        aestheticFit: creator.aestheticFit,
        authorityTrust: creator.authorityTrust,
        logisticsFit: creator.logisticsFit,
        purchaseIntent: creator.purchaseIntent,
      }),
    [creator],
  );
  const suggestion = evaluationSuggestion(creator.stage, score);

  useEffect(() => {
    if (!dirtyRef.current) {
      return;
    }

    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      const response = await fetch(`/api/creators/${creator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: creator.name,
          handle: creator.handle,
          platform: creator.platform,
          profileUrl: creator.profileUrl,
          email: creator.email,
          location: creator.location,
          niche: creator.niche,
          source: creator.source,
          audienceSummary: creator.audienceSummary,
          whyFit: creator.whyFit,
          notes: creator.notes,
          tags: creator.tags,
          followers: creator.followers,
          engagementRate: creator.engagementRate,
          estimatedReach: creator.estimatedReach,
          contentLiveUrl: creator.contentLiveUrl,
          affiliateCode: creator.affiliateCode,
          conversions: creator.conversions,
          revenueCents: creator.revenueCents,
          stage: creator.stage,
          priority: creator.priority,
          audienceFit: creator.audienceFit,
          contentQuality: creator.contentQuality,
          aestheticFit: creator.aestheticFit,
          authorityTrust: creator.authorityTrust,
          logisticsFit: creator.logisticsFit,
          purchaseIntent: creator.purchaseIntent,
        }),
      });

      if (!response.ok) {
        setSaveState("dirty");
        toast.error("Autosave failed.");
        return;
      }

      const updated = await response.json();
      setCreator((current) => ({ ...current, overallScore: updated.overallScore }));
      setSaveState("saved");
      dirtyRef.current = false;
      router.refresh();
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [creator, router]);

  function update<K extends keyof CreatorDetail>(key: K, value: CreatorDetail[K]) {
    dirtyRef.current = true;
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
        toast.success("Task added.");
        router.refresh();
      }
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
        toast.success("Note added.");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid gap-6">
        <Card className="haus-panel">
          <CardContent className="grid gap-5 p-5">
            <div className="flex items-start justify-between gap-6">
              <div className="grid flex-1 gap-3">
                <Input value={creator.name} onChange={(event) => update("name", event.target.value)} className="h-12 border-0 bg-transparent px-0 text-3xl font-semibold shadow-none focus-visible:ring-0" />
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Input value={creator.handle} onChange={(event) => update("handle", event.target.value)} className="h-8 w-44" />
                  <Input value={creator.platform} onChange={(event) => update("platform", event.target.value)} className="h-8 w-36" />
                  {creator.profileUrl ? (
                    <a href={creator.profileUrl} target="_blank" className="flex items-center gap-1 hover:text-foreground">
                      Profile <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-5xl">{score.toFixed(1)}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">overall</div>
                <Badge className="mt-3" variant={saveState === "saved" ? "secondary" : "outline"}>
                  {saveState === "saving" ? <Save className="size-3" /> : <Check className="size-3" />}
                  {saveState}
                </Badge>
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
              <Label>Audience summary</Label>
              <Textarea value={creator.audienceSummary ?? ""} onChange={(event) => update("audienceSummary", event.target.value)} className="min-h-24" />
            </div>
            <div className="grid gap-2">
              <Label>Why fit</Label>
              <Textarea value={creator.whyFit ?? ""} onChange={(event) => update("whyFit", event.target.value)} className="min-h-24" />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="notes" className="grid gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="interactions">Interactions</TabsTrigger>
            <TabsTrigger value="briefs">Briefs</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="notes">
            <Card className="haus-panel">
              <CardHeader>
                <CardTitle>Working notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={creator.notes} onChange={(event) => update("notes", event.target.value)} className="min-h-72 text-base leading-7" placeholder="Drop sourcing notes, objections, creative angles, and next moves here." />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tasks">
            <Card className="haus-panel">
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
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
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{task.title}</div>
                      <Badge variant={task.status === "DONE" ? "secondary" : "outline"}>{task.status}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}</div>
                  </div>
                ))}
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
