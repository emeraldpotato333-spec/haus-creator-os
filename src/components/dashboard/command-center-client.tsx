"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, CirclePause, FileStack, Library, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  defaultBossApprovalNeeded,
  describeCurrentStatus,
  getDecisionHelper,
  getGroupedPipelineLane,
  getMissingDecisionFields,
  getPrimaryActionLabel,
  getSuggestedExactStepForTier,
  getSuggestedNextAction,
  getTierShortLabel,
  getWaitingReason,
  GROUPED_PIPELINE_LANES,
  isProofOrAdsReady,
  isWaiting,
  rankTodayCandidates,
  TODAY_FOCUS_LIMIT,
  TIER_CONFIG,
  type CommandCenterCreator,
} from "@/lib/creator-command-center";
import { CreatorAvatar, StageBadge } from "@/components/creators/creator-identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type DashboardCreator = CommandCenterCreator & {
  platform: string;
  profileImageUrl?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

type FlywheelStep = {
  label: string;
  count: number;
};

const flywheelLabels = [
  "Classify",
  "Offer",
  "Approve",
  "Brief",
  "Ship",
  "Capture",
  "Advertise",
  "Recruit",
] as const;

export function CommandCenterClient({ creators }: { creators: DashboardCreator[] }) {
  const [items, setItems] = useState(creators);
  const [selectedId, setSelectedId] = useState(() => getInitialClassifyTarget(creators)?.id ?? "");
  const [isPending, startTransition] = useTransition();

  const todaysThree = useMemo(
    () =>
      [...items]
        .filter((creator) => creator.isTodayFocus)
        .sort((left, right) => (left.todayFocusRank ?? 99) - (right.todayFocusRank ?? 99))
        .slice(0, TODAY_FOCUS_LIMIT),
    [items],
  );
  const needsDecisionItems = useMemo(
    () => items.filter((creator) => getMissingDecisionFields(creator).length > 0),
    [items],
  );
  const waitingItems = useMemo(
    () => items.filter((creator) => isWaiting(creator)),
    [items],
  );
  const proofItems = useMemo(
    () => items.filter((creator) => isProofOrAdsReady(creator)),
    [items],
  );
  const selectedCreator =
    needsDecisionItems.find((creator) => creator.id === selectedId) ??
    needsDecisionItems[0] ??
    items[0] ??
    null;
  const decisionHelperTarget = todaysThree[0] ?? needsDecisionItems[0] ?? proofItems[0] ?? waitingItems[0] ?? items[0] ?? null;

  const flywheel = useMemo(() => getFlywheelCounts(items), [items]);

  function patchCreator(id: string, patch: Partial<DashboardCreator>, successMessage?: string) {
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
            ? {
                ...creator,
                ...patch,
                overallScore: typeof result?.overallScore === "number" ? result.overallScore : creator.overallScore,
              }
            : creator,
        ),
      );

      if (successMessage) {
        toast.success(successMessage);
      }
    });
  }

  function chooseTodaysThree() {
    const ranked = rankTodayCandidates(items);
    if (!ranked.length) {
      toast.message("No clear Today’s 3 yet. Classify a few leads first.");
      return;
    }

    const nextById = new Map(ranked.map((creator, index) => [creator.id, index + 1]));
    const updates = items
      .filter((creator) => creator.isTodayFocus || nextById.has(creator.id))
      .map(async (creator) => {
        const rank = nextById.get(creator.id);
        const patch = {
          isTodayFocus: Boolean(rank),
          todayFocusRank: rank ?? null,
        };

        const response = await fetch(`/api/creators/${creator.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });

        if (!response.ok) {
          throw new Error("Today’s 3 update failed.");
        }

        return { id: creator.id, patch };
      });

    startTransition(async () => {
      try {
        const resolved = await Promise.all(updates);
        const patches = new Map(resolved.map((entry) => [entry.id, entry.patch]));
        setItems((current) =>
          current.map((creator) => {
            const patch = patches.get(creator.id);
            return patch ? { ...creator, ...patch } : creator;
          }),
        );
        toast.success("Today’s 3 is set.");
      } catch {
        toast.error("Today’s 3 could not be updated.");
      }
    });
  }

  function submitQuickClassify(formData: FormData) {
    if (!selectedCreator) {
      return;
    }

    const tierValue = getString(formData, "tier");
    const patch = {
      projectType: getNullableString(formData, "projectType"),
      tier: tierValue ? (tierValue as DashboardCreator["tier"]) : null,
      exactStep: tierValue ? getSuggestedExactStepForTier(tierValue as DashboardCreator["tier"]) : null,
      collabAngle: getNullableString(formData, "collabAngle"),
      bossApprovalNeeded: getNullableBoolean(formData, "bossApprovalNeeded"),
      nextAction: getNullableString(formData, "nextAction"),
    } satisfies Partial<DashboardCreator>;

    patchCreator(selectedCreator.id, patch, "Creator classified.");
  }

  return (
    <div className="grid gap-5">
      <Card className="haus-panel overflow-hidden">
        <CardContent className="grid gap-4 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Flywheel
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Keep it visible. Do the next smallest high-ROI move.
              </div>
            </div>
            <Link href="/pipeline" className="text-sm text-muted-foreground hover:text-foreground">
              Use this for overview. Do daily work from the Dashboard.
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
            {flywheel.map((step) => (
              <div key={step.label} className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{step.label}</div>
                <div className="mt-2 font-mono text-2xl">{step.count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="haus-panel">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Today’s 3</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Pick three. The rest can wait.</p>
              </div>
              <Button variant="outline" onClick={chooseTodaysThree} disabled={isPending}>
                Choose Today’s 3
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4">
            {todaysThree.length ? (
              todaysThree.map((creator) => <TodayCard key={creator.id} creator={creator} onPause={() => patchCreator(creator.id, { isTodayFocus: false, todayFocusRank: null }, "Removed from Today’s 3.")} />)
            ) : (
              <EmptyState
                title="Choose three leads for today. The rest can wait."
                body="Today’s win: three real moves."
                actionLabel="Choose Today’s 3"
                onAction={chooseTodaysThree}
              />
            )}
          </CardContent>
        </Card>

        <Card className="haus-panel">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" />
              Decision Helper
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-4">
            {decisionHelperTarget ? (
              <>
                <div className="text-sm text-muted-foreground">{decisionHelperTarget.name}</div>
                <div className="text-xl font-medium">{getDecisionHelper(decisionHelperTarget).title}</div>
                <p className="text-sm leading-6 text-muted-foreground">{getDecisionHelper(decisionHelperTarget).body}</p>
                <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  The flywheel is built from reps, not perfect planning.
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Add one creator and the helper will narrow the next move.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="haus-panel">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="size-4" />
                  Needs Decision
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">These are not tasks yet. They just need classification.</p>
              </div>
              <Badge variant="outline">{needsDecisionItems.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4">
            {needsDecisionItems.length ? (
              <>
                <div className="grid gap-2">
                  {needsDecisionItems.slice(0, 6).map((creator) => (
                    <button
                      key={creator.id}
                      onClick={() => setSelectedId(creator.id)}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors hover:bg-accent/30 ${selectedCreator?.id === creator.id ? "bg-accent/40" : "bg-background/40"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{creator.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{getMissingDecisionFields(creator).join(", ")}</div>
                        </div>
                        <Badge variant="secondary" className="bg-muted text-foreground">
                          {getTierShortLabel(creator.tier)}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
                {selectedCreator ? (
                  <form key={selectedCreator.id} action={submitQuickClassify} className="grid gap-4 rounded-2xl border border-border/70 bg-background/60 p-4">
                    <div className="flex items-center gap-3">
                      <CreatorAvatar creator={selectedCreator} />
                      <div>
                        <div className="font-medium">{selectedCreator.name}</div>
                        <div className="text-sm text-muted-foreground">{selectedCreator.handle}</div>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <Label>Project type</Label>
                        <Input name="projectType" defaultValue={selectedCreator.projectType ?? ""} placeholder="Kitchen, bath, fireplace, UGC set" />
                      </label>
                      <label className="grid gap-2">
                        <Label>Tier</Label>
                        <Select
                          name="tier"
                          defaultValue={selectedCreator.tier ?? ""}
                          onValueChange={(value) => {
                            const tier = value as keyof typeof TIER_CONFIG;
                            const next = getSuggestedNextAction(tier);
                            const approval = defaultBossApprovalNeeded(tier);
                            const nextInput = document.querySelector<HTMLInputElement>('input[name="nextAction"]');
                            if (nextInput && !nextInput.value) {
                              nextInput.value = next;
                            }
                            const select = document.querySelector<HTMLButtonElement>('[data-boss-approval-trigger="true"]');
                            if (select && approval !== null) {
                              select.dataset.defaultValue = approval ? "true" : "false";
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose tier" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIER_CONFIG).map(([value, config]) => (
                              <SelectItem key={value} value={value}>
                                {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                    <label className="grid gap-2">
                      <Label>Collab angle</Label>
                      <Textarea name="collabAngle" defaultValue={selectedCreator.collabAngle ?? ""} className="min-h-24" placeholder="One sharp angle. No full brief yet." />
                    </label>
                    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                      <label className="grid gap-2">
                        <Label>Boss approval needed?</Label>
                        <Select name="bossApprovalNeeded" defaultValue={selectedCreator.bossApprovalNeeded === null ? "" : String(selectedCreator.bossApprovalNeeded)}>
                          <SelectTrigger data-boss-approval-trigger="true">
                            <SelectValue placeholder="Choose" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="grid gap-2">
                        <Label>Next action</Label>
                        <Input name="nextAction" defaultValue={selectedCreator.nextAction ?? ""} placeholder="Prepare boss approval packet" />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">Classify first. Then move.</p>
                      <Button disabled={isPending}>Quick classify</Button>
                    </div>
                  </form>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="Classification is clear."
                body="Every creator on the board already has the core decision fields."
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <CompactSection
            title="Waiting Room"
            subtitle="This is parked, not forgotten."
            icon={<CirclePause className="size-4" />}
            items={waitingItems}
            emptyText="Nothing is parked right now."
            renderMeta={(creator) => getWaitingReason(creator) ?? describeCurrentStatus(creator.stage)}
          />
          <CompactSection
            title="Proof / Ads Ready"
            subtitle="Turn delivered assets into proof and paid creative."
            icon={<Library className="size-4" />}
            items={proofItems}
            emptyText="No proof-ready content yet."
            renderMeta={(creator) => {
              if (creator.usageRightsStatus !== "CONFIRMED") return "Usage rights need confirmation";
              if (creator.adPotential === "HIGH") return "High ad potential";
              return describeCurrentStatus(creator.stage);
            }}
          />
          <Card className="haus-panel">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileStack className="size-4" />
                Lanes at a glance
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4">
              {GROUPED_PIPELINE_LANES.map((lane) => {
                const count = items.filter((creator) => getGroupedPipelineLane(creator.stage, creator.exactStep) === lane.id).length;
                return (
                  <div key={lane.id} className="rounded-xl border border-border/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{lane.label}</div>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{lane.note}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TodayCard({
  creator,
  onPause,
}: {
  creator: DashboardCreator;
  onPause: () => void;
}) {
  const primaryActionLabel = getPrimaryActionLabel(creator);
  const actionHref = primaryActionLabel.includes("brief")
    ? `/creators/${creator.id}`
    : primaryActionLabel.includes("proof")
      ? `/creators/${creator.id}`
      : primaryActionLabel.includes("wait")
        ? `/creators/${creator.id}`
        : "/templates";

  return (
    <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CreatorAvatar creator={creator} />
          <div>
            <div className="font-medium">{creator.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">{creator.handle}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="bg-muted text-foreground">
                {getTierShortLabel(creator.tier)}
              </Badge>
              {creator.projectType ? (
                <Badge variant="outline">{creator.projectType}</Badge>
              ) : null}
              <StageBadge stage={creator.stage} />
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl">{creator.overallScore.toFixed(1)}</div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">fit score</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 rounded-xl border border-border/60 bg-background/70 p-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Current status</div>
          <div className="mt-1">{describeCurrentStatus(creator.stage)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Collab angle</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {creator.collabAngle ?? "Add one line on why this creator is worth the next move."}
          </p>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Next action</div>
          <p className="mt-1 font-medium">{creator.nextAction ?? getSuggestedNextAction(creator.tier)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button render={<Link href={actionHref} />}>{primaryActionLabel}</Button>
        <button onClick={onPause} className="text-sm text-muted-foreground hover:text-foreground">
          Remove from Today’s 3
        </button>
      </div>
    </div>
  );
}

function CompactSection({
  title,
  subtitle,
  icon,
  items,
  emptyText,
  renderMeta,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: DashboardCreator[];
  emptyText: string;
  renderMeta: (creator: DashboardCreator) => string;
}) {
  return (
    <Card className="haus-panel">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {icon}
              {title}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Badge variant="outline">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-4">
        {items.length ? (
          items.slice(0, 5).map((creator) => (
            <Link key={creator.id} href={`/creators/${creator.id}`} className="rounded-xl border border-border/70 bg-background/50 px-4 py-3 transition-colors hover:bg-accent/25">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{creator.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{renderMeta(creator)}</div>
                </div>
                <Badge variant="secondary" className="bg-muted text-foreground">
                  {getTierShortLabel(creator.tier)}
                </Badge>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed px-6 py-10 text-center">
      <div className="text-base font-medium">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {actionLabel && onAction ? (
        <Button variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function getFlywheelCounts(creators: DashboardCreator[]): FlywheelStep[] {
  return [
    { label: flywheelLabels[0], count: creators.filter((creator) => getMissingDecisionFields(creator).length > 0).length },
    { label: flywheelLabels[1], count: creators.filter((creator) => ["INVITED", "REPLIED", "QUALIFIED"].includes(creator.stage)).length },
    { label: flywheelLabels[2], count: creators.filter((creator) => creator.bossApprovalNeeded && creator.bossApprovalStatus !== "APPROVED").length },
    { label: flywheelLabels[3], count: creators.filter((creator) => creator.briefStatus === "DRAFT" || creator.briefStatus === "SENT" || (["REPLIED", "QUALIFIED"].includes(creator.stage) && !creator.briefStatus)).length },
    { label: flywheelLabels[4], count: creators.filter((creator) => creator.sampleStatus === "PENDING" || creator.sampleStatus === "SENT").length },
    { label: flywheelLabels[5], count: creators.filter((creator) => creator.stage === "CONTENT_LIVE" || creator.stage === "EVALUATED").length },
    { label: flywheelLabels[6], count: creators.filter((creator) => creator.usageRightsStatus === "CONFIRMED" || creator.adPotential === "HIGH").length },
    { label: flywheelLabels[7], count: creators.filter((creator) => creator.stage === "SOURCED" || creator.stage === "VETTED").length },
  ].map((step) => ({
    ...step,
    label: step.label,
  }));
}

function getInitialClassifyTarget(creators: DashboardCreator[]) {
  return creators.find((creator) => getMissingDecisionFields(creator).length > 0) ?? null;
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getNullableBoolean(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value) {
    return null;
  }

  return value === "true";
}
