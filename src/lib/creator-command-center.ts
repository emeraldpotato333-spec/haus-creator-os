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

export const WORKFLOW_LANES = [
  {
    id: "DECIDE",
    label: "Decide",
    note: "Use this for classification and intake cleanup.",
  },
  {
    id: "OUTREACH",
    label: "Outreach",
    note: "Send the ask, follow up, and handle replies.",
  },
  {
    id: "COMMIT",
    label: "Commit",
    note: "Only move here once the creator is genuinely in play.",
  },
  {
    id: "ASSET",
    label: "Asset",
    note: "Turn real content into proof, rights, and ads.",
  },
] as const;

export type WorkflowLane = (typeof WORKFLOW_LANES)[number]["id"];
export const GROUPED_PIPELINE_LANES = WORKFLOW_LANES;

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
    deliverables:
      "Main Reel or TikTok, Stories, install clips, final photos, raw footage, usage rights.",
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

export const EXACT_STEP_VALUES = [
  "NEEDS_TIER",
  "NEEDS_PROJECT_TYPE",
  "NEEDS_COLLAB_ANGLE",
  "NEEDS_NEXT_ACTION",
  "VETTED",
  "PAUSED_NURTURE",
  "WRITE_COLLAB_EMAIL",
  "SEND_PERSONALIZED_COLLAB_EMAIL",
  "SEND_UGC_PAID_AD_INQUIRY",
  "WAITING_FOR_REPLY",
  "REPLIED_YES",
  "REPLIED_NO",
  "FOLLOW_UP",
  "PREPARE_BOSS_APPROVAL_PACKET",
  "WAITING_FOR_BOSS_APPROVAL",
  "BOSS_APPROVED",
  "WRITE_BRIEF",
  "BRIEF_SENT",
  "BRIEF_ACCEPTED",
  "SHIP_SAMPLES_PRODUCT",
  "SAMPLES_PRODUCT_SENT",
  "WAITING_FOR_CONTENT",
  "CONTENT_RECEIVED",
  "CONFIRM_USAGE_RIGHTS",
  "USAGE_RIGHTS_CONFIRMED",
  "ADD_TO_PROOF_LIBRARY",
  "MARK_AD_READY",
  "RUNNING_AS_AD",
  "RECRUIT_MORE",
] as const;

export type ExactStepValue = (typeof EXACT_STEP_VALUES)[number];

const exactStepDefinitions: Array<{
  value: ExactStepValue;
  label: string;
  lane: WorkflowLane;
  stage: PipelineStage;
  nextAction: string;
  templateName?: string;
}> = [
  { value: "NEEDS_TIER", label: "Needs tier", lane: "DECIDE", stage: "SOURCED", nextAction: "Set tier" },
  { value: "NEEDS_PROJECT_TYPE", label: "Needs project type", lane: "DECIDE", stage: "SOURCED", nextAction: "Set project type" },
  { value: "NEEDS_COLLAB_ANGLE", label: "Needs collab angle", lane: "DECIDE", stage: "SOURCED", nextAction: "Set collab angle" },
  { value: "NEEDS_NEXT_ACTION", label: "Needs next action", lane: "DECIDE", stage: "SOURCED", nextAction: "Set next action" },
  { value: "VETTED", label: "Vetted", lane: "DECIDE", stage: "VETTED", nextAction: "Choose outreach move" },
  { value: "PAUSED_NURTURE", label: "Paused / nurture", lane: "DECIDE", stage: "VETTED", nextAction: "Send light nurture message or pause" },
  { value: "WRITE_COLLAB_EMAIL", label: "Write collab email", lane: "OUTREACH", stage: "INVITED", nextAction: "Write collab email" },
  {
    value: "SEND_PERSONALIZED_COLLAB_EMAIL",
    label: "Send personalized collab email",
    lane: "OUTREACH",
    stage: "INVITED",
    nextAction: "Send personalized collab email",
    templateName: "Tier 2 Personalized Collab Email",
  },
  {
    value: "SEND_UGC_PAID_AD_INQUIRY",
    label: "Send UGC paid ad inquiry",
    lane: "OUTREACH",
    stage: "INVITED",
    nextAction: "Send UGC paid ad inquiry",
    templateName: "Tier 3 UGC Paid Ads Inquiry",
  },
  { value: "WAITING_FOR_REPLY", label: "Waiting for reply", lane: "OUTREACH", stage: "INVITED", nextAction: "Mark waiting" },
  { value: "REPLIED_YES", label: "Replied yes", lane: "OUTREACH", stage: "REPLIED", nextAction: "Write brief" },
  { value: "REPLIED_NO", label: "Replied no", lane: "OUTREACH", stage: "REPLIED", nextAction: "Send light nurture message or pause" },
  { value: "FOLLOW_UP", label: "Follow up", lane: "OUTREACH", stage: "INVITED", nextAction: "Follow up" },
  {
    value: "PREPARE_BOSS_APPROVAL_PACKET",
    label: "Prepare boss approval packet",
    lane: "COMMIT",
    stage: "QUALIFIED",
    nextAction: "Prepare boss approval packet",
    templateName: "Tier 1 Boss Approval Packet",
  },
  {
    value: "WAITING_FOR_BOSS_APPROVAL",
    label: "Waiting for boss approval",
    lane: "COMMIT",
    stage: "QUALIFIED",
    nextAction: "Mark waiting",
  },
  { value: "BOSS_APPROVED", label: "Boss approved", lane: "COMMIT", stage: "QUALIFIED", nextAction: "Write brief" },
  {
    value: "WRITE_BRIEF",
    label: "Write brief",
    lane: "COMMIT",
    stage: "BRIEF_SENT",
    nextAction: "Write brief",
    templateName: "Brief After Yes",
  },
  {
    value: "BRIEF_SENT",
    label: "Brief sent",
    lane: "COMMIT",
    stage: "BRIEF_SENT",
    nextAction: "Wait for brief acceptance",
    templateName: "Brief After Yes",
  },
  {
    value: "BRIEF_ACCEPTED",
    label: "Brief accepted",
    lane: "COMMIT",
    stage: "BRIEF_SENT",
    nextAction: "Ship samples/product",
    templateName: "Brief After Yes",
  },
  { value: "SHIP_SAMPLES_PRODUCT", label: "Ship samples/product", lane: "COMMIT", stage: "SAMPLE_SENT", nextAction: "Ship samples/product" },
  { value: "SAMPLES_PRODUCT_SENT", label: "Samples/product sent", lane: "COMMIT", stage: "SAMPLE_SENT", nextAction: "Wait for content" },
  { value: "WAITING_FOR_CONTENT", label: "Waiting for content", lane: "ASSET", stage: "SAMPLE_SENT", nextAction: "Mark waiting" },
  { value: "CONTENT_RECEIVED", label: "Content received", lane: "ASSET", stage: "CONTENT_LIVE", nextAction: "Confirm usage rights" },
  {
    value: "CONFIRM_USAGE_RIGHTS",
    label: "Confirm usage rights",
    lane: "ASSET",
    stage: "EVALUATED",
    nextAction: "Confirm usage rights",
    templateName: "Usage rights checklist",
  },
  {
    value: "USAGE_RIGHTS_CONFIRMED",
    label: "Usage rights confirmed",
    lane: "ASSET",
    stage: "EVALUATED",
    nextAction: "Add to proof library",
    templateName: "Usage rights checklist",
  },
  {
    value: "ADD_TO_PROOF_LIBRARY",
    label: "Add to proof library",
    lane: "ASSET",
    stage: "EXPANDED",
    nextAction: "Add to proof library",
    templateName: "Proof / Ad Review Checklist",
  },
  {
    value: "MARK_AD_READY",
    label: "Mark ad ready",
    lane: "ASSET",
    stage: "EXPANDED",
    nextAction: "Mark ad ready",
    templateName: "Proof / Ad Review Checklist",
  },
  {
    value: "RUNNING_AS_AD",
    label: "Running as ad",
    lane: "ASSET",
    stage: "AMBASSADOR",
    nextAction: "Recruit more",
    templateName: "Proof / Ad Review Checklist",
  },
  { value: "RECRUIT_MORE", label: "Recruit more", lane: "ASSET", stage: "AMBASSADOR", nextAction: "Recruit more" },
];

const exactStepMap = new Map(exactStepDefinitions.map((step) => [step.value, step]));

export const EXACT_STEP_OPTIONS_BY_LANE = WORKFLOW_LANES.map((lane) => ({
  ...lane,
  steps: exactStepDefinitions.filter((step) => step.lane === lane.id),
}));

export const BOSS_APPROVAL_STATUS_OPTIONS = [
  { value: "NEEDS_APPROVAL", label: "Needs approval" },
  { value: "WAITING", label: "Waiting" },
  { value: "APPROVED", label: "Approved" },
  { value: "DECLINED", label: "Declined" },
] as const;

export const SAMPLE_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "SENT", label: "Sent" },
  { value: "DELIVERED", label: "Delivered" },
] as const;

export const BRIEF_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
] as const;

export const USAGE_RIGHTS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
] as const;

export const AD_POTENTIAL_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

export type CommandCenterCreator = {
  id: string;
  name: string;
  handle: string;
  stage: PipelineStage;
  overallScore: number;
  nextAction: string | null;
  exactStep: ExactStepValue | null;
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

export function isExactStepValue(value: unknown): value is ExactStepValue {
  return typeof value === "string" && EXACT_STEP_VALUES.includes(value as ExactStepValue);
}

export function getExactStepConfig(exactStep: ExactStepValue | null | undefined) {
  return exactStep ? exactStepMap.get(exactStep) ?? null : null;
}

export function getExactStepLabel(exactStep: ExactStepValue | null | undefined) {
  return getExactStepConfig(exactStep)?.label ?? "Needs exact step";
}

export function getExactStepsForLane(lane: WorkflowLane) {
  return exactStepDefinitions.filter((step) => step.lane === lane);
}

export function getExactStepTemplateName(exactStep: ExactStepValue | null | undefined) {
  return getExactStepConfig(exactStep)?.templateName ?? null;
}

export function getTierLabel(tier: CreatorTier | null | undefined) {
  return tier ? TIER_CONFIG[tier].label : "Unclassified";
}

export function getTierShortLabel(tier: CreatorTier | null | undefined) {
  return tier ? TIER_CONFIG[tier].shortLabel : "Needs tier";
}

export function getSuggestedNextAction(tier: CreatorTier | null | undefined) {
  return tier ? TIER_CONFIG[tier].defaultNextAction : "";
}

export function getSuggestedExactStepForTier(tier: CreatorTier | null | undefined): ExactStepValue | null {
  if (tier === "TIER_1") return "PREPARE_BOSS_APPROVAL_PACKET";
  if (tier === "TIER_2") return "SEND_PERSONALIZED_COLLAB_EMAIL";
  if (tier === "TIER_3") return "SEND_UGC_PAID_AD_INQUIRY";
  if (tier === "TIER_4") return "PAUSED_NURTURE";
  return null;
}

export function defaultBossApprovalNeeded(tier: CreatorTier | null | undefined) {
  return tier ? TIER_CONFIG[tier].bossApprovalNeeded : null;
}

export function getStageForExactStep(exactStep: ExactStepValue) {
  return getExactStepConfig(exactStep)?.stage ?? "SOURCED";
}

export function getWorkflowLaneForExactStep(exactStep: ExactStepValue | null | undefined) {
  return getExactStepConfig(exactStep)?.lane ?? null;
}

export function getGroupedPipelineLane(stage: PipelineStage, exactStep?: ExactStepValue | null): WorkflowLane {
  const laneFromExactStep = getWorkflowLaneForExactStep(exactStep);

  if (laneFromExactStep) {
    return laneFromExactStep;
  }

  if (stage === "SOURCED" || stage === "VETTED") return "DECIDE";
  if (stage === "INVITED" || stage === "REPLIED" || stage === "QUALIFIED") return "OUTREACH";
  if (stage === "SAMPLE_SENT" || stage === "BRIEF_SENT") return "COMMIT";
  return "ASSET";
}

export function getMissingDecisionFields(
  creator: Pick<CommandCenterCreator, "tier" | "nextAction" | "projectType" | "collabAngle" | "bossApprovalNeeded">,
) {
  return [
    !creator.tier ? "tier" : null,
    !creator.nextAction ? "next action" : null,
    !creator.projectType ? "project type" : null,
    !creator.collabAngle ? "collab angle" : null,
    creator.bossApprovalNeeded === null ? "boss approval" : null,
  ].filter(Boolean) as string[];
}

export function needsDecision(
  creator: Pick<CommandCenterCreator, "tier" | "nextAction" | "projectType" | "collabAngle" | "bossApprovalNeeded" | "exactStep">,
) {
  return (
    getMissingDecisionFields(creator).length > 0 ||
    creator.exactStep === "NEEDS_TIER" ||
    creator.exactStep === "NEEDS_PROJECT_TYPE" ||
    creator.exactStep === "NEEDS_COLLAB_ANGLE" ||
    creator.exactStep === "NEEDS_NEXT_ACTION"
  );
}

export function hasPositiveReply(creator: Pick<CommandCenterCreator, "stage" | "exactStep">) {
  if (creator.exactStep === "REPLIED_YES") {
    return true;
  }

  return ["REPLIED", "QUALIFIED", "SAMPLE_SENT", "BRIEF_SENT", "CONTENT_LIVE", "EVALUATED", "EXPANDED", "AMBASSADOR"].includes(creator.stage);
}

export function shouldEncourageBrief(creator: Pick<CommandCenterCreator, "stage" | "briefStatus" | "exactStep">) {
  return hasPositiveReply(creator) && !creator.briefStatus;
}

export function getWaitingReason(
  creator: Pick<CommandCenterCreator, "stage" | "exactStep" | "bossApprovalStatus" | "sampleStatus">,
) {
  if (creator.exactStep === "WAITING_FOR_REPLY") return "Waiting for reply";
  if (creator.exactStep === "WAITING_FOR_BOSS_APPROVAL" || creator.bossApprovalStatus === "WAITING") return "Waiting for boss approval";
  if (creator.exactStep === "WAITING_FOR_CONTENT") return "Waiting for content";
  if (creator.sampleStatus === "SENT") return "Waiting for sample delivery";
  if (creator.stage === "INVITED") return "Waiting for reply";
  return null;
}

export function isWaiting(
  creator: Pick<CommandCenterCreator, "stage" | "exactStep" | "bossApprovalStatus" | "sampleStatus">,
) {
  return Boolean(getWaitingReason(creator));
}

export function isProofOrAdsReady(
  creator: Pick<CommandCenterCreator, "stage" | "exactStep" | "usageRightsStatus" | "adPotential">,
) {
  if (
    creator.exactStep === "CONTENT_RECEIVED" ||
    creator.exactStep === "CONFIRM_USAGE_RIGHTS" ||
    creator.exactStep === "USAGE_RIGHTS_CONFIRMED" ||
    creator.exactStep === "ADD_TO_PROOF_LIBRARY" ||
    creator.exactStep === "MARK_AD_READY" ||
    creator.exactStep === "RUNNING_AS_AD"
  ) {
    return true;
  }

  if (creator.stage === "CONTENT_LIVE" && creator.usageRightsStatus !== "CONFIRMED") {
    return true;
  }

  return creator.usageRightsStatus === "CONFIRMED" || creator.adPotential === "HIGH";
}

export function getDecisionHelper(
  creator: Pick<
    CommandCenterCreator,
    "name" | "tier" | "bossApprovalStatus" | "nextAction" | "stage" | "exactStep" | "briefStatus" | "sampleStatus" | "usageRightsStatus" | "adPotential"
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

  if (creator.tier === "TIER_2" && creator.exactStep !== "SEND_PERSONALIZED_COLLAB_EMAIL" && (!creator.nextAction || !creator.nextAction.toLowerCase().includes("email"))) {
    return {
      title: "Keep it light",
      body: "Send personalized collab email. No full brief yet.",
    };
  }

  if (creator.tier === "TIER_3" && creator.exactStep !== "SEND_UGC_PAID_AD_INQUIRY" && (!creator.nextAction || !creator.nextAction.toLowerCase().includes("ugc"))) {
    return {
      title: "Focus on paid asset fit",
      body: "Send UGC paid ad inquiry. Focus on ad assets, not organic reach.",
    };
  }

  if (hasPositiveReply(creator) && !creator.briefStatus) {
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

  if ((creator.exactStep === "CONTENT_RECEIVED" || creator.stage === "CONTENT_LIVE") && creator.usageRightsStatus !== "CONFIRMED") {
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

export function getPrimaryActionLabel(
  creator: Pick<CommandCenterCreator, "nextAction" | "stage" | "tier" | "exactStep" | "usageRightsStatus" | "adPotential" | "briefStatus">,
) {
  if (creator.exactStep) {
    if (creator.exactStep === "PREPARE_BOSS_APPROVAL_PACKET") return "Prepare boss packet";
    if (creator.exactStep === "SEND_UGC_PAID_AD_INQUIRY") return "Write UGC inquiry";
    if (creator.exactStep === "SEND_PERSONALIZED_COLLAB_EMAIL" || creator.exactStep === "WRITE_COLLAB_EMAIL") return "Write collab email";
    if (creator.exactStep === "CONFIRM_USAGE_RIGHTS") return "Confirm usage rights";
    if (creator.exactStep === "ADD_TO_PROOF_LIBRARY" || creator.exactStep === "MARK_AD_READY") return "Add to proof library";
    if (creator.exactStep === "WAITING_FOR_REPLY" || creator.exactStep === "WAITING_FOR_BOSS_APPROVAL" || creator.exactStep === "WAITING_FOR_CONTENT") return "Mark waiting";
  }

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

export function getQuickAction(exactStep: ExactStepValue | null | undefined) {
  if (!exactStep) {
    return null;
  }

  if (
    exactStep === "WRITE_COLLAB_EMAIL" ||
    exactStep === "SEND_PERSONALIZED_COLLAB_EMAIL" ||
    exactStep === "SEND_UGC_PAID_AD_INQUIRY" ||
    exactStep === "FOLLOW_UP"
  ) {
    return { label: "Mark waiting", exactStep: "WAITING_FOR_REPLY" as ExactStepValue };
  }

  if (exactStep === "WAITING_FOR_REPLY") {
    return { label: "Mark yes", exactStep: "REPLIED_YES" as ExactStepValue };
  }

  if (exactStep === "WRITE_BRIEF") {
    return { label: "Mark brief sent", exactStep: "BRIEF_SENT" as ExactStepValue };
  }

  if (exactStep === "WAITING_FOR_CONTENT") {
    return { label: "Mark content received", exactStep: "CONTENT_RECEIVED" as ExactStepValue };
  }

  if (exactStep === "USAGE_RIGHTS_CONFIRMED" || exactStep === "ADD_TO_PROOF_LIBRARY") {
    return { label: "Mark ad ready", exactStep: "MARK_AD_READY" as ExactStepValue };
  }

  return null;
}

export function getDefaultExactStepForLane(
  lane: WorkflowLane,
  creator: Pick<CommandCenterCreator, "tier" | "projectType" | "collabAngle" | "nextAction">,
) {
  if (lane === "DECIDE") {
    if (!creator.tier) return "NEEDS_TIER";
    if (!creator.projectType) return "NEEDS_PROJECT_TYPE";
    if (!creator.collabAngle) return "NEEDS_COLLAB_ANGLE";
    if (!creator.nextAction) return "NEEDS_NEXT_ACTION";
    return "VETTED";
  }

  if (lane === "OUTREACH") {
    if (creator.tier === "TIER_3") return "SEND_UGC_PAID_AD_INQUIRY";
    if (creator.tier === "TIER_2") return "SEND_PERSONALIZED_COLLAB_EMAIL";
    return "WRITE_COLLAB_EMAIL";
  }

  if (lane === "COMMIT") {
    if (creator.tier === "TIER_1") return "PREPARE_BOSS_APPROVAL_PACKET";
    return "WRITE_BRIEF";
  }

  return "WAITING_FOR_CONTENT";
}

export function getLegacyExactStepFromStage(
  stage: PipelineStage,
  nextAction?: string | null,
  tier?: CreatorTier | null,
): ExactStepValue {
  const action = nextAction?.toLowerCase() ?? "";

  if (action.includes("ugc")) return "SEND_UGC_PAID_AD_INQUIRY";
  if (action.includes("boss")) return "PREPARE_BOSS_APPROVAL_PACKET";
  if (action.includes("brief")) return stage === "BRIEF_SENT" ? "BRIEF_SENT" : "WRITE_BRIEF";
  if (action.includes("usage")) return "CONFIRM_USAGE_RIGHTS";
  if (action.includes("proof")) return "ADD_TO_PROOF_LIBRARY";
  if (action.includes("reply") || action.includes("wait")) return "WAITING_FOR_REPLY";
  if (action.includes("follow")) return "FOLLOW_UP";
  if (action.includes("pause") || action.includes("nurture")) return "PAUSED_NURTURE";
  if (action.includes("email") && tier === "TIER_2") return "SEND_PERSONALIZED_COLLAB_EMAIL";

  if (stage === "VETTED") return "VETTED";
  if (stage === "INVITED") return "WAITING_FOR_REPLY";
  if (stage === "REPLIED") return "REPLIED_YES";
  if (stage === "QUALIFIED") return tier === "TIER_1" ? "PREPARE_BOSS_APPROVAL_PACKET" : "WRITE_BRIEF";
  if (stage === "BRIEF_SENT") return "BRIEF_SENT";
  if (stage === "SAMPLE_SENT") return "WAITING_FOR_CONTENT";
  if (stage === "CONTENT_LIVE") return "CONTENT_RECEIVED";
  if (stage === "EVALUATED") return "CONFIRM_USAGE_RIGHTS";
  if (stage === "EXPANDED") return "MARK_AD_READY";
  if (stage === "AMBASSADOR") return "RECRUIT_MORE";

  return "NEEDS_TIER";
}

export function getWorkflowPatchForExactStep(exactStep: ExactStepValue) {
  const config = getExactStepConfig(exactStep);

  if (!config) {
    return {
      exactStep,
      stage: "SOURCED" as PipelineStage,
      nextAction: "Set next action",
    };
  }

  const patch: {
    exactStep: ExactStepValue;
    stage: PipelineStage;
    nextAction: string;
    bossApprovalStatus?: BossApprovalStatus | null;
    sampleStatus?: SampleStatus | null;
    briefStatus?: CreatorBriefStatus | null;
    usageRightsStatus?: UsageRightsStatus | null;
    adPotential?: AdPotential | null;
  } = {
    exactStep,
    stage: config.stage,
    nextAction: config.nextAction,
  };

  if (exactStep === "PREPARE_BOSS_APPROVAL_PACKET") patch.bossApprovalStatus = "NEEDS_APPROVAL";
  if (exactStep === "WAITING_FOR_BOSS_APPROVAL") patch.bossApprovalStatus = "WAITING";
  if (exactStep === "BOSS_APPROVED") patch.bossApprovalStatus = "APPROVED";

  if (exactStep === "WRITE_BRIEF") patch.briefStatus = "DRAFT";
  if (exactStep === "BRIEF_SENT") patch.briefStatus = "SENT";
  if (exactStep === "BRIEF_ACCEPTED") patch.briefStatus = "ACCEPTED";

  if (exactStep === "SHIP_SAMPLES_PRODUCT") patch.sampleStatus = "PENDING";
  if (exactStep === "SAMPLES_PRODUCT_SENT" || exactStep === "WAITING_FOR_CONTENT") patch.sampleStatus = "SENT";
  if (exactStep === "CONTENT_RECEIVED") patch.sampleStatus = "DELIVERED";

  if (exactStep === "CONFIRM_USAGE_RIGHTS") patch.usageRightsStatus = "PENDING";
  if (
    exactStep === "USAGE_RIGHTS_CONFIRMED" ||
    exactStep === "ADD_TO_PROOF_LIBRARY" ||
    exactStep === "MARK_AD_READY" ||
    exactStep === "RUNNING_AS_AD" ||
    exactStep === "RECRUIT_MORE"
  ) {
    patch.usageRightsStatus = "CONFIRMED";
  }

  if (exactStep === "ADD_TO_PROOF_LIBRARY") patch.adPotential = "MEDIUM";
  if (exactStep === "MARK_AD_READY" || exactStep === "RUNNING_AS_AD") patch.adPotential = "HIGH";

  return patch;
}

export function getContentStatusLabel(exactStep: ExactStepValue | null | undefined) {
  if (!exactStep) return "No content yet";
  if (exactStep === "WAITING_FOR_CONTENT") return "Waiting for content";
  if (exactStep === "CONTENT_RECEIVED") return "Content received";
  if (
    exactStep === "CONFIRM_USAGE_RIGHTS" ||
    exactStep === "USAGE_RIGHTS_CONFIRMED" ||
    exactStep === "ADD_TO_PROOF_LIBRARY" ||
    exactStep === "MARK_AD_READY" ||
    exactStep === "RUNNING_AS_AD" ||
    exactStep === "RECRUIT_MORE"
  ) {
    return "Content received";
  }

  return "No content yet";
}

export function describeCurrentStatus(stage: PipelineStage, exactStep?: ExactStepValue | null) {
  return exactStep ? getExactStepLabel(exactStep) : stageLabel(stage);
}

function scoreTodayCandidate(creator: CommandCenterCreator) {
  let score = creator.overallScore;

  if (creator.isTodayFocus) score += 100;
  if (creator.exactStep === "REPLIED_YES") score += 5;
  if (!creator.nextAction) score += 3;
  if (needsDecision(creator)) score += 2;
  if (creator.tier === "TIER_1" || creator.tier === "TIER_2") score += 1;

  return score;
}
