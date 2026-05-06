"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Download, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/app/confirm-action";
import {
  AD_POTENTIAL_OPTIONS,
  BOSS_APPROVAL_STATUS_OPTIONS,
  BRIEF_STATUS_OPTIONS,
  describeCurrentStatus,
  ExactStepValue,
  EXACT_STEP_OPTIONS_BY_LANE,
  getContentStatusLabel,
  getExactStepTemplateName,
  getLegacyExactStepFromStage,
  getMissingDecisionFields,
  getQuickAction,
  getSuggestedExactStepForTier,
  getSuggestedNextAction,
  isExactStepValue,
  isProofOrAdsReady,
  isWaiting,
  SAMPLE_STATUS_OPTIONS,
  USAGE_RIGHTS_OPTIONS,
} from "@/lib/creator-command-center";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CreatorListItem = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  profileImageUrl: string | null;
  niche: string | null;
  stage: "SOURCED" | "VETTED" | "INVITED" | "REPLIED" | "QUALIFIED" | "SAMPLE_SENT" | "BRIEF_SENT" | "CONTENT_LIVE" | "EVALUATED" | "EXPANDED" | "AMBASSADOR";
  priority: "LOW" | "MEDIUM" | "HIGH";
  projectType: string | null;
  collabAngle: string | null;
  tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  exactStep: string | null;
  bossApprovalNeeded: boolean | null;
  bossApprovalStatus: "NEEDS_APPROVAL" | "WAITING" | "APPROVED" | "DECLINED" | null;
  sampleStatus: "PENDING" | "SENT" | "DELIVERED" | null;
  briefStatus: "DRAFT" | "SENT" | "ACCEPTED" | null;
  usageRightsStatus: "PENDING" | "CONFIRMED" | null;
  adPotential: "LOW" | "MEDIUM" | "HIGH" | null;
  isTodayFocus: boolean;
  todayFocusRank: number | null;
  tags: string[];
  nextAction: string | null;
  overallScore: number;
};

type LeadFilter = "TODAY" | "NEEDS_DECISION" | "WAITING" | "ASSETS_READY" | "ALL";

export function CreatorsClient({ creators }: { creators: CreatorListItem[] }) {
  const [items, setItems] = useState(creators.map(normalizeCreator));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LeadFilter>("TODAY");
  const [deleteTarget, setDeleteTarget] = useState<CreatorListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    return items.filter((creator) => {
      const matchesQuery =
        !q ||
        [
          creator.name,
          creator.handle,
          creator.projectType,
          creator.collabAngle,
          creator.nextAction,
          creator.exactStep,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      if (!matchesQuery) {
        return false;
      }

      switch (filter) {
        case "TODAY":
          return Boolean(creator.isTodayFocus);
        case "NEEDS_DECISION":
          return getMissingDecisionFields(creator).length > 0;
        case "WAITING":
          return isWaiting(creator);
        case "ASSETS_READY":
          return isProofOrAdsReady(creator);
        default:
          return true;
      }
    });
  }, [filter, items, query]);

  async function deleteCreator() {
    if (!deleteTarget) {
      return;
    }

    const response = await fetch(`/api/creators/${deleteTarget.id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Creator could not be deleted.");
      return;
    }

    setItems((current) => current.filter((creator) => creator.id !== deleteTarget.id));
    toast.success("Creator deleted.");
  }

  async function importCsv(kind: "creators" | "tasks", file: File | undefined) {
    if (!file) {
      return;
    }

    const csv = await file.text();
    const response = await fetch("/api/import/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, csv }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? "CSV import failed.");
      return;
    }

    toast.success(kind === "creators" ? "Creators imported." : "Tasks imported.");
    window.location.reload();
  }

  function patchCreator(id: string, patch: Partial<CreatorListItem>, successMessage?: string) {
    startTransition(async () => {
      const response = await fetch(`/api/creators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(result?.error ?? "Creator update failed.");
        return;
      }

      setItems((current) =>
        current.map((creator) =>
          creator.id === id
            ? normalizeCreator({
                ...creator,
                ...patch,
                stage: result?.stage ?? patch.stage ?? creator.stage,
                exactStep: result?.exactStep ?? patch.exactStep ?? creator.exactStep,
                nextAction: result?.nextAction ?? patch.nextAction ?? creator.nextAction,
                bossApprovalStatus: result?.bossApprovalStatus ?? patch.bossApprovalStatus ?? creator.bossApprovalStatus,
                sampleStatus: result?.sampleStatus ?? patch.sampleStatus ?? creator.sampleStatus,
                briefStatus: result?.briefStatus ?? patch.briefStatus ?? creator.briefStatus,
                usageRightsStatus: result?.usageRightsStatus ?? patch.usageRightsStatus ?? creator.usageRightsStatus,
                adPotential: result?.adPotential ?? patch.adPotential ?? creator.adPotential,
              })
            : creator,
        ),
      );

      if (result?.schemaWarning) {
        toast.message(result.schemaWarning);
      } else if (successMessage) {
        toast.success(successMessage);
      }
    });
  }

  function updateTier(creator: CreatorListItem, tier: CreatorListItem["tier"]) {
    const exactStep = getSuggestedExactStepForTier(tier ?? null);
    const nextAction = getSuggestedNextAction(tier ?? null) || creator.nextAction || null;
    patchCreator(
      creator.id,
      {
        tier,
        nextAction,
        exactStep,
        bossApprovalNeeded: tier === "TIER_1",
      },
      "Tier updated.",
    );
  }

  function updateExactStep(creator: CreatorListItem, exactStep: ExactStepValue) {
    patchCreator(
      creator.id,
      {
        exactStep,
      },
      "Exact step updated.",
    );
  }

  if (items.length === 0) {
    return (
      <div className="grid gap-5">
        <div className="rounded-md border border-dashed p-12 text-center">
          <div className="text-lg font-medium">Add one creator. Do not build the whole system first.</div>
          <div className="mt-2 text-sm text-muted-foreground">The worksheet gets useful the moment one real lead exists.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Card className="haus-panel">
        <CardContent className="grid gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Lead Tracker</div>
              <div className="mt-1 text-sm text-muted-foreground">
                The working spreadsheet. Dashboard is the cockpit. Pipeline is the overview.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" render={<a href="/api/export?type=creators-csv" />}>
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
                  onChange={(event) => importCsv("creators", event.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Search creator, handle, project type, collab angle, next action..."
            />
          </div>

          <Tabs value={filter} onValueChange={(value) => value && setFilter(value as LeadFilter)}>
            <TabsList variant="line">
              <TabsTrigger value="TODAY">Today</TabsTrigger>
              <TabsTrigger value="NEEDS_DECISION">Needs decision</TabsTrigger>
              <TabsTrigger value="WAITING">Waiting</TabsTrigger>
              <TabsTrigger value="ASSETS_READY">Assets ready</TabsTrigger>
              <TabsTrigger value="ALL">All leads</TabsTrigger>
            </TabsList>
            <TabsContent value={filter} className="mt-4">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead>Handle</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Project type</TableHead>
                      <TableHead>Collab angle</TableHead>
                      <TableHead>Next action</TableHead>
                      <TableHead>Exact step</TableHead>
                      <TableHead>Boss approval</TableHead>
                      <TableHead>Sample status</TableHead>
                      <TableHead>Brief status</TableHead>
                      <TableHead>Content status</TableHead>
                      <TableHead>Usage rights</TableHead>
                      <TableHead>Ad potential</TableHead>
                      <TableHead>Today focus</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((creator) => {
                      const templateName = getExactStepTemplateName(creator.exactStep);
                      const quickAction = getQuickAction(creator.exactStep);

                      return (
                        <TableRow key={creator.id} className="hover:bg-transparent">
                          <TableCell className="min-w-[180px]">
                            <Link href={`/creators/${creator.id}`} className="font-medium hover:text-foreground">
                              {creator.name}
                            </Link>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {describeCurrentStatus(creator.stage, creator.exactStep)}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[150px] text-muted-foreground">{creator.handle}</TableCell>
                          <TableCell className="min-w-[160px]">
                            <Select value={creator.tier ?? ""} onValueChange={(value) => updateTier(creator, value ? (value as CreatorListItem["tier"]) : null)}>
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder="Needs tier" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TIER_1">Tier 1</SelectItem>
                                <SelectItem value="TIER_2">Tier 2</SelectItem>
                                <SelectItem value="TIER_3">Tier 3</SelectItem>
                                <SelectItem value="TIER_4">Tier 4</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[160px]">
                            <EditableInput
                              key={`${creator.id}-project-${creator.projectType ?? ""}`}
                              value={creator.projectType ?? ""}
                              placeholder="Project type"
                              onSave={(value) => patchCreator(creator.id, { projectType: value || null }, "Project type updated.")}
                            />
                          </TableCell>
                          <TableCell className="min-w-[220px]">
                            <EditableInput
                              key={`${creator.id}-angle-${creator.collabAngle ?? ""}`}
                              value={creator.collabAngle ?? ""}
                              placeholder="One-line collab angle"
                              onSave={(value) => patchCreator(creator.id, { collabAngle: value || null }, "Collab angle updated.")}
                            />
                          </TableCell>
                          <TableCell className="min-w-[220px]">
                            <EditableInput
                              key={`${creator.id}-next-${creator.nextAction ?? ""}`}
                              value={creator.nextAction ?? ""}
                              placeholder="One clear next action"
                              onSave={(value) => patchCreator(creator.id, { nextAction: value || null }, "Next action updated.")}
                            />
                          </TableCell>
                          <TableCell className="min-w-[230px]">
                            <Select value={creator.exactStep ?? ""} onValueChange={(value) => value && updateExactStep(creator, value as ExactStepValue)}>
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder="Choose step" />
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
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <Select value={creator.bossApprovalStatus ?? ""} onValueChange={(value) => patchCreator(creator.id, { bossApprovalStatus: value ? (value as CreatorListItem["bossApprovalStatus"]) : null }, "Boss approval updated.")}>
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                {BOSS_APPROVAL_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            <Select value={creator.sampleStatus ?? ""} onValueChange={(value) => patchCreator(creator.id, { sampleStatus: value ? (value as CreatorListItem["sampleStatus"]) : null }, "Sample status updated.")}>
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                {SAMPLE_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[130px]">
                            <Select value={creator.briefStatus ?? ""} onValueChange={(value) => patchCreator(creator.id, { briefStatus: value ? (value as CreatorListItem["briefStatus"]) : null }, "Brief status updated.")}>
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                {BRIEF_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[140px] text-muted-foreground">
                            {getContentStatusLabel(creator.exactStep)}
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            <Select value={creator.usageRightsStatus ?? ""} onValueChange={(value) => patchCreator(creator.id, { usageRightsStatus: value ? (value as CreatorListItem["usageRightsStatus"]) : null }, "Usage rights updated.")}>
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                {USAGE_RIGHTS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[130px]">
                            <Select value={creator.adPotential ?? ""} onValueChange={(value) => patchCreator(creator.id, { adPotential: value ? (value as CreatorListItem["adPotential"]) : null }, "Ad potential updated.")}>
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                {AD_POTENTIAL_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[110px]">
                            <Button
                              variant={creator.isTodayFocus ? "default" : "outline"}
                              size="sm"
                              onClick={() =>
                                patchCreator(
                                  creator.id,
                                  {
                                    isTodayFocus: !creator.isTodayFocus,
                                    todayFocusRank: !creator.isTodayFocus ? 1 : null,
                                  },
                                  creator.isTodayFocus ? "Removed from Today." : "Added to Today.",
                                )
                              }
                              disabled={isPending}
                            >
                              {creator.isTodayFocus ? "Today" : "Set today"}
                            </Button>
                          </TableCell>
                          <TableCell className="min-w-[240px]">
                            <div className="flex flex-wrap gap-2">
                              {templateName ? (
                                <Button size="sm" variant="outline" render={<Link href={`/templates?template=${encodeURIComponent(templateName)}`} />}>
                                  Open matching template
                                </Button>
                              ) : null}
                              <Button size="sm" variant="ghost" render={<Link href={`/creators/${creator.id}`} />}>
                                Open creator
                              </Button>
                              {quickAction ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateExactStep(creator, quickAction.exactStep)}
                                >
                                  {quickAction.label}
                                </Button>
                              ) : null}
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Delete ${creator.name}`}
                                onClick={() => setDeleteTarget(creator)}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          No leads match that view.
        </div>
      ) : null}

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "creator"}?`}
        description="This removes the creator and related tasks from the workspace."
        confirmLabel="Delete creator"
        onConfirm={deleteCreator}
      />
    </div>
  );
}

function EditableInput({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) {
          onSave(draft.trim());
        }
      }}
      className="h-8"
      placeholder={placeholder}
    />
  );
}

function normalizeCreator(creator: CreatorListItem) {
  const exactStep = isExactStepValue(creator.exactStep)
    ? creator.exactStep
    : getLegacyExactStepFromStage(creator.stage, creator.nextAction, creator.tier ?? null);

  return {
    ...creator,
    exactStep,
    bossApprovalNeeded: creator.bossApprovalNeeded ?? (creator.tier === "TIER_1"),
  };
}
