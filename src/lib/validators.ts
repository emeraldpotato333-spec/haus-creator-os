import { z } from "zod";
import { calculateOverallScore } from "@/lib/domain";

const nullableString = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null));

const optionalString = z.string().optional().default("");

const updateNullableString = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value ? value : null;
  });

const nullableInt = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().int().nonnegative().nullable().optional(),
);

const nullableNumber = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().nonnegative().nullable().optional(),
);

const nullableDate = z
  .string()
  .nullable()
  .optional()
  .transform((value) => (value ? new Date(value) : null));

const updateNullableDate = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value ? new Date(value) : null;
  });

export const pipelineStageSchema = z.enum([
  "SOURCED",
  "VETTED",
  "INVITED",
  "REPLIED",
  "QUALIFIED",
  "SAMPLE_SENT",
  "BRIEF_SENT",
  "CONTENT_LIVE",
  "EVALUATED",
  "EXPANDED",
  "AMBASSADOR",
]);

export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const creatorInputSchema = z.object({
  name: z.string().trim().min(1),
  handle: z.string().trim().min(1),
  platform: z.string().trim().min(1).default("Instagram"),
  profileUrl: nullableString,
  profileImageUrl: nullableString,
  email: nullableString,
  location: nullableString,
  niche: nullableString,
  source: nullableString,
  audienceSummary: nullableString,
  whyFit: nullableString,
  nextAction: nullableString,
  notes: optionalString,
  tags: z.array(z.string()).default([]),
  followers: nullableInt,
  engagementRate: nullableNumber,
  estimatedReach: nullableInt,
  contentLiveUrl: nullableString,
  affiliateCode: nullableString,
  conversions: z.coerce.number().int().nonnegative().default(0),
  revenueCents: z.coerce.number().int().nonnegative().default(0),
  stage: pipelineStageSchema.default("SOURCED"),
  lastContactedAt: nullableDate,
  nextFollowUpAt: nullableDate,
  priority: prioritySchema.default("MEDIUM"),
  visualFitScore: z.coerce.number().int().min(0).max(10).default(0),
  commercialFitScore: z.coerce.number().int().min(0).max(10).default(0),
  contentQuality: z.coerce.number().int().min(0).max(10).default(0),
  trustPurchaseIntentScore: z.coerce.number().int().min(0).max(10).default(0),
  overallScoreOverride: nullableNumber,
});

export const creatorUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  handle: z.string().trim().min(1).optional(),
  platform: z.string().trim().min(1).optional(),
  profileUrl: updateNullableString,
  profileImageUrl: updateNullableString,
  email: updateNullableString,
  location: updateNullableString,
  niche: updateNullableString,
  source: updateNullableString,
  audienceSummary: updateNullableString,
  whyFit: updateNullableString,
  nextAction: updateNullableString,
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  followers: nullableInt,
  engagementRate: nullableNumber,
  estimatedReach: nullableInt,
  contentLiveUrl: updateNullableString,
  affiliateCode: updateNullableString,
  conversions: z.coerce.number().int().nonnegative().optional(),
  revenueCents: z.coerce.number().int().nonnegative().optional(),
  stage: pipelineStageSchema.optional(),
  lastContactedAt: updateNullableDate,
  nextFollowUpAt: updateNullableDate,
  priority: prioritySchema.optional(),
  visualFitScore: z.coerce.number().int().min(0).max(10).optional(),
  commercialFitScore: z.coerce.number().int().min(0).max(10).optional(),
  contentQuality: z.coerce.number().int().min(0).max(10).optional(),
  trustPurchaseIntentScore: z.coerce.number().int().min(0).max(10).optional(),
  overallScoreOverride: nullableNumber,
});

export function withOverallScore(data: z.infer<typeof creatorInputSchema>) {
  return {
    ...data,
    overallScore: calculateOverallScore(data, data.overallScoreOverride),
  };
}

export const taskInputSchema = z.object({
  creatorId: z.string().nullable().optional(),
  title: z.string().trim().min(1),
  details: z.string().optional().default(""),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueDate: z
    .string()
    .nullable()
    .optional()
    .transform((value) => (value ? new Date(value) : null)),
});

export const templateInputSchema = z.object({
  name: z.string().trim().min(1),
  category: z.enum(["OUTREACH", "FOLLOW_UP", "BRIEF", "OFFER", "RIGHTS", "NURTURE"]),
  subject: nullableString,
  body: z.string().min(1),
  notes: z.string().optional().default(""),
  variables: z.array(z.string()).default([]),
  isStarter: z.boolean().optional().default(false),
});

export const interactionInputSchema = z.object({
  creatorId: z.string().nullable().optional(),
  type: z.enum(["NOTE", "EMAIL", "DM", "CALL", "SAMPLE", "CONTENT", "INTERNAL"]).default("NOTE"),
  channel: nullableString,
  title: z.string().trim().min(1),
  body: z.string().optional().default(""),
  happenedAt: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : new Date())),
});

export const briefInputSchema = z.object({
  creatorId: z.string().nullable().optional(),
  title: z.string().trim().min(1),
  body: z.string().min(1),
  status: z.enum(["DRAFT", "SENT", "CONTENT_LIVE", "REVIEWED"]).default("DRAFT"),
  dueDate: z
    .string()
    .nullable()
    .optional()
    .transform((value) => (value ? new Date(value) : null)),
});
