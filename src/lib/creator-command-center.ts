import type {
  AdPotential,
  BossApprovalStatus,
  CreatorBriefStatus,
  CreatorTier,
  PipelineStage,
  SampleStatus,
  UsageRightsStatus,
} from "@/generated/prisma/client";
import { stageLabel } from "@/lib/domain";

export const TODAY_FOCUS_LIMIT = 3;

export const TIER_CONFIG: Record<
  CreatorTier,
  {
    label: string;
    shortLabel: string;
    definition: string;
    offer: string;
    defaultNextAction: string;
    deliverables: string;
    bossApprovalNeeded: boolean;
  }
> = {
  TIER_1: {
    label: "Tier 1: Anchor Collaborator",
    shortLabel: "Tier 1",
    definition:
      "Bigger creator, larger renovation area, and strong HAUS proof potential.",
    offer: "Deep collaboration, material support, possible free product.",
    defaultNextAction: "Prepare boss approval packet",
    deliverables: "Main Reel or TikTok, Stories, install clips, final photos, raw footage, usage rights.",
    bossApprovalNeeded: true,
  },
  TIER_2: {
    label: "Tier 2: Design Partner",
    shortLabel: "Tier 2",
    definition: "Strong creator or project worth careful, personalized treatment.",
    offer: "Samples, partial product support, preferred pricing.",
    defaultNextAction: "Send personalized collab email",
    deliverables: "1 Reel, Stories, raw footage, install photos, repost permission.",
    bossApprovalNeeded: false,
  },
  TIER_3: {
    label: "Tier 3: UGC Paid Ads Creator",
    shortLabel: "Tier 3",
    definition: "Useful primarily for believable paid ad assets, not organic reach.",
    offer: "Lower paid UGC fee, sample shipment, clear shot list.",
    defaultNextAction: "Send UGC paid ad inquiry",
    deliverables: "3 raw videos, 5 hooks, 3 B-roll clips.",
    bossApprovalNeeded: false,
  },
  TIER_4: {
    label: "Tier 4: Seed / Nurture",
    shortLabel: "Tier 4",
    definition: "Small creator, unclear timing, or weak fit for an immediate push.",
    offer: "Sample only, moodboard help, or stay in touch.",
    defaultNextAction: "Send light nurture message or pause",
    deliverables: "Light touch only until fit improves.",
    bossApprovalNeeded: false,
  },
};

export const GROUPED_PIPELINE_LANES = [
  { id: "DECIDE", label: "Decide", note: "Use this lane to classify leads before work expands.", stages: ["SOURCED", "VETTED"] as PipelineStage[] },
  { id: "OUTREACH", label: "Outreach", note: "Light contact and reply handling.", stages: ["INVITED", "REPLIED", "QUALIFIED"] as PipelineStage[] },
  { id: "COMMIT", label: "Commit", note: "Only move here once there is real intent.", stages: ["SAMPLE_SENT", "BRIEF_SENT"] as PipelineStage[] },
  { id: "ASSET", label: "Asset", note: "Content, proof, and ad-readiness.", stages: ["CONTENT_LIVE", "EVALUATED", "EXPANDED", "AMBASSADOR"] as PipelineStage[] },
] as const;

export type GroupedPipelineLane = (typeof GROUPED_PIPELINE_LANES)[number]["id"];

export type CommandCenterCreator = {
  id: string;
  name: string;
  handle: string;
  stage: PipelineStage;
  overallScore: number;
  nextAction: string | null;
  projectType: string | null;
  collabAngle: string | null;
  tier: CreatorTier | null;
  bossApprovalNeeded: boolean | null;
  bossApprovalStatus: BossApprovalStatus | null;
  sampleStatus: SampleStatus | null;
  briefStatus: CreatorBriefStatus | null;
  usageRightsStatus: UsageRightsStatus | null;
  adPotential: AdPotential | null;
  isTodayFocus: boolean;
  todayFocusRank: number | null;
};

export function getTierLabel(tier: CreatorTier | null | undefined) {
  return tier ? TIER_CONFIG[tier].label : "Unclassified";
}

export function getTierShortLabel(tier: CreatorTier | null | undefined) {
  return tier ? TIER_CONFIG[tier].shortLabel : "Needs tier";
}

export function getSuggestedNextAction(tier: CreatorTier | null | undefined) {
  return tier ? TIER_CONFIG[tier].defaultNextAction : "";
}

export function defaultBossApprovalNeeded(tier: CreatorTier | null | undefined) {
  return tier ? TIER_CONFIG[tier].bossApprovalNeeded : null;
}

export function getGroupedPipelineLane(stage: PipelineStage): GroupedPipelineLane {
  return (
    GROUPED_PIPELINE_LANES.find((lane) => lane.stages.includes(stage))?.id ?? "DECIDE"
  );
}

export function getMissingDecisionFields(creator: Pick<CommandCenterCreator, "tier" | "nextAction" | "projectType" | "collabAngle" | "bossApprovalNeeded">) {
  return [
    !creator.tier ? "tier" : null,
    !creator.nextAction ? "next action" : null,
    !creator.projectType ? "project type" : null,
    !creator.collabAngle ? "collab angle" : null,
    creator.bossApprovalNeeded === null ? "boss approval" : null,
  ].filter(Boolean) as string[];
}

export function needsDecision(creator: Pick<CommandCenterCreator, "tier" | "nextAction" | "projectType" | "collabAngle" | "bossApprovalNeeded">) {
  return getMissingDecisionFields(creator).length > 0;
}

export function hasPositiveReply(stage: PipelineStage) {
  return ["REPLIED", "QUALIFIED", "SAMPLE_SENT", "BRIEF_SENT", "CONTENT_LIVE", "EVALUATED", "EXPANDED", "AMBASSADOR"].includes(stage);
}

export function shouldEncourageBrief(creator: Pick<CommandCenterCreator, "stage" | "briefStatus">) {
  return hasPositiveReply(creator.stage) && !creator.briefStatus;
}

export function getWaitingReason(
  creator: Pick<CommandCenterCreator, "stage" | "bossApprovalStatus" | "sampleStatus">,
) {
  if (creator.stage === "INVITED") return "Waiting for reply";
  if (creator.bossApprovalStatus === "WAITING") return "Waiting for boss approval";
  if (creator.sampleStatus === "SENT") return "Waiting for sample delivery";
  if (creator.stage === "BRIEF_SENT") return "Waiting for content";
  if (creator.stage === "CONTENT_LIVE") return "Waiting for posting date";
  return null;
}

export function isWaiting(creator: Pick<CommandCenterCreator, "stage" | "bossApprovalStatus" | "sampleStatus">) {
  return Boolean(getWaitingReason(creator));
}

export function isProofOrAdsReady(
  creator: Pick<CommandCenterCreator, "stage" | "usageRightsStatus" | "adPotential">,
) {
  if (creator.stage === "CONTENT_LIVE" && creator.usageRightsStatus !== "CONFIRMED") {
    return true;
  }

  return creator.usageRightsStatus === "CONFIRMED" || creator.adPotential === "HIGH";
}

export function getDecisionHelper(
  creator: Pick<
    CommandCenterCreator,
    "name" | "tier" | "bossApprovalStatus" | "nextAction" | "stage" | "briefStatus" | "sampleStatus" | "usageRightsStatus" | "adPotential"
  >,
) {
  if (!creator.tier) {
    return {
      title: `Classify ${creator.name} first`,
      body: "Classify first. Do not email yet.",
    };
  }

  if (creator.tier === "TIER_1" && creator.bossApprovalStatus !== "APPROVED") {
    return {
      title: "Approval before promises",
      body: "Prepare boss packet before promising product.",
    };
  }

  if (creator.tier === "TIER_2" && (!creator.nextAction || !creator.nextAction.toLowerCase().includes("email"))) {
    return {
      title: "Keep it light",
      body: "Send personalized collab email. No full brief yet.",
    };
  }

  if (creator.tier === "TIER_3" && (!creator.nextAction || !creator.nextAction.toLowerCase().includes("ugc"))) {
    return {
      title: "Focus on paid asset fit",
      body: "Send UGC paid ad inquiry. Focus on ad assets, not organic reach.",
    };
  }

  if (hasPositiveReply(creator.stage) && !creator.briefStatus) {
    return {
      title: "The yes changed the work",
      body: "Now write the brief.",
    };
  }

  if (creator.briefStatus === "ACCEPTED" && creator.sampleStatus !== "SENT" && creator.sampleStatus !== "DELIVERED") {
    return {
      title: "Move from planning to shipping",
      body: "Now ship samples or product.",
    };
  }

  if (creator.stage === "CONTENT_LIVE" && creator.usageRightsStatus !== "CONFIRMED") {
    return {
      title: "Rights before spend",
      body: "Confirm usage rights before running paid ads.",
    };
  }

  if (creator.usageRightsStatus === "CONFIRMED" && creator.adPotential === "HIGH") {
    return {
      title: "Proof becomes performance",
      body: "Add to proof library and mark ad ready.",
    };
  }

  return {
    title: "Keep the next move small",
    body: "Every creator needs one clear next action.",
  };
}

export function getPrimaryActionLabel(creator: Pick<CommandCenterCreator, "nextAction" | "stage" | "tier" | "usageRightsStatus" | "adPotential" | "briefStatus">) {
  if (shouldEncourageBrief(creator)) {
    return "Create brief";
  }

  const action = creator.nextAction?.toLowerCase() ?? "";

  if (action.includes("boss")) return "Prepare boss packet";
  if (action.includes("ugc")) return "Write UGC inquiry";
  if (action.includes("email")) return "Write collab email";
  if (action.includes("proof") || action.includes("ad")) return "Add to proof library";
  if (action.includes("wait")) return "Mark waiting";
  if (creator.usageRightsStatus === "CONFIRMED" && creator.adPotential === "HIGH") return "Add to proof library";
  if (creator.tier === "TIER_4") return "Pause or nurture";

  return "Open creator";
}

export function rankTodayCandidates<T extends CommandCenterCreator>(creators: T[]) {
  return [...creators]
    .filter((creator) => !isWaiting(creator))
    .sort((left, right) => scoreTodayCandidate(right) - scoreTodayCandidate(left))
    .slice(0, TODAY_FOCUS_LIMIT);
}

function scoreTodayCandidate(creator: CommandCenterCreator) {
  let score = creator.overallScore;

  if (creator.isTodayFocus) score += 100;
  if (creator.stage === "REPLIED" || creator.stage === "QUALIFIED") score += 4;
  if (!creator.nextAction) score += 3;
  if (needsDecision(creator)) score += 2;
  if (creator.tier === "TIER_1" || creator.tier === "TIER_2") score += 1;

  return score;
}

export function describeCurrentStatus(stage: PipelineStage) {
  return stageLabel(stage);
}
