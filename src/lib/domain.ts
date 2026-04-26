import type { PipelineStage } from "@/generated/prisma/client";

export const PIPELINE_STAGES: { value: PipelineStage; label: string }[] = [
  { value: "SOURCED", label: "Sourced" },
  { value: "VETTED", label: "Vetted" },
  { value: "INVITED", label: "Invited" },
  { value: "REPLIED", label: "Replied" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "SAMPLE_SENT", label: "Sample Sent" },
  { value: "BRIEF_SENT", label: "Brief Sent" },
  { value: "CONTENT_LIVE", label: "Content Live" },
  { value: "EVALUATED", label: "Evaluated" },
  { value: "EXPANDED", label: "Expanded" },
  { value: "AMBASSADOR", label: "Ambassador" },
];

export const SCORE_FIELDS = [
  { key: "visualFitScore", label: "Visual fit" },
  { key: "commercialFitScore", label: "Commercial fit" },
  { key: "contentQuality", label: "Content quality" },
  { key: "trustPurchaseIntentScore", label: "Trust / purchase intent" },
] as const;

export type ScoreField = (typeof SCORE_FIELDS)[number]["key"];

export const AUTOMATION_RULES: Partial<
  Record<PipelineStage, { title: string; details: string; dueInDays: number; key: string }>
> = {
  INVITED: {
    title: "Send follow-up",
    details: "Follow up on the HAUS creator invitation if no response has landed.",
    dueInDays: 4,
    key: "stage:invited:follow-up",
  },
  REPLIED: {
    title: "Review qualification fit",
    details: "Check audience, design authority, style fit, logistics, and next best ask.",
    dueInDays: 1,
    key: "stage:replied:qualification-review",
  },
  SAMPLE_SENT: {
    title: "Check sample delivery",
    details: "Confirm the package arrived and capture any early content ideas.",
    dueInDays: 7,
    key: "stage:sample-sent:delivery-check",
  },
  BRIEF_SENT: {
    title: "Content check-in",
    details: "Make sure the brief is clear and the creator has what they need.",
    dueInDays: 5,
    key: "stage:brief-sent:content-check-in",
  },
  CONTENT_LIVE: {
    title: "Evaluate live content",
    details: "Review creative quality, audience response, comments, saves, and purchase intent.",
    dueInDays: 2,
    key: "stage:content-live:evaluation",
  },
};

export function stageLabel(stage: PipelineStage) {
  return PIPELINE_STAGES.find((item) => item.value === stage)?.label ?? stage;
}

export function calculateOverallScore(scores: Record<ScoreField, number>, override?: number | null) {
  if (typeof override === "number" && Number.isFinite(override)) {
    return Math.round(override * 10) / 10;
  }

  const total = SCORE_FIELDS.reduce((sum, field) => sum + Number(scores[field.key] || 0), 0);
  return Math.round((total / SCORE_FIELDS.length) * 10) / 10;
}

export function evaluationSuggestion(stage: PipelineStage, overallScore: number) {
  if (stage === "EVALUATED" && overallScore >= 8) {
    return overallScore >= 9 ? "Ambassador" : "Expanded";
  }

  return null;
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
