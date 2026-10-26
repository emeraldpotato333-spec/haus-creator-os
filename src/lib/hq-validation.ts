import { z } from "zod";

export const HQ_STAGES = ["contacted", "conversation", "scoping", "agreement", "delivery", "content", "complete", "archived"] as const;
export const HQ_WAITING_ON = ["haus", "creator", "william", "none"] as const;
export const HQ_DECISION_STATUSES = ["none", "requested", "ready"] as const;
export const HQ_TASK_STATES = ["open", "in_progress", "done"] as const;

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use a real calendar date in YYYY-MM-DD format.");

const evidenceSchema = z.object({
  id: z.string().max(200).optional(),
  label: z.string().min(1).max(300),
  url: z.string().url().refine((url) => /^https?:\/\//i.test(url), "Only HTTP(S) source links are supported.").optional(),
  observedAt: z.string().max(100),
  note: z.string().max(10000),
}).passthrough();

// Only these planning fields can change through the shared board. Identity,
// source evidence, consent, commercial terms and actual milestones stay read-only.
export const hqChangesSchema = z.object({
  stage: z.enum(HQ_STAGES).optional(),
  owner: z.string().trim().min(1).max(80).optional(),
  nextAction: z.string().trim().min(1).max(2000).optional(),
  dueDate: dateOnlySchema.nullable().optional(),
  waitingOn: z.enum(HQ_WAITING_ON).optional(),
  archiveReason: z.string().trim().max(1000).optional(),
  notes: z.string().max(10000).optional(),
  warmth: z.number().int().min(1).max(5).nullable().optional(),
  decisionReason: z.string().max(5000).optional(),
  decisionStatus: z.enum(HQ_DECISION_STATUSES).optional(),
  taskState: z.enum(HQ_TASK_STATES).optional(),
}).strict().refine((changes) => Object.keys(changes).length > 0, "Provide at least one planning change.");

export const hqPatchSchema = z.object({
  version: z.number().int().positive(),
  mutationId: z.string().uuid(),
  changes: hqChangesSchema,
}).strict();

export const hqRecordDataSchema = z.object({
  name: z.string().min(1).max(200),
  handle: z.string().min(1).max(200),
  cohort: z.enum(["pilot", "case_study", "trial", "existing"]),
  summary: z.string().max(10000),
  platform: z.string().max(80).optional(),
  profileUrl: z.string().url().refine((url) => /^https?:\/\//i.test(url), "Only HTTP(S) profile links are supported.").optional(),
  warmth: z.number().int().min(1).max(5).nullable().optional(),
  locationPriority: z.enum(["local_la", "regional", "remote", "unknown"]).optional(),
  project: z.string().max(5000).optional(),
  timing: z.string().max(5000).optional(),
  sampleStatus: z.string().max(2000).optional(),
  agreementStatus: z.string().max(2000).optional(),
  shippingStatus: z.string().max(2000).optional(),
  verifiedAt: z.string().max(100).optional(),
  evidence: z.array(evidenceSchema).max(200).optional(),
  milestones: z.record(z.string(), z.json()).optional(),
  tags: z.array(z.string().max(100)).max(100).optional(),
  doNotContact: z.boolean().optional(),
  contactPolicy: z.enum(["manual", "agent", "review"]).optional(),
  decisionReason: z.string().max(5000).optional(),
  stage: z.enum(HQ_STAGES).default("conversation"),
  owner: z.string().trim().min(1).max(80).default("Agent"),
  nextAction: z.string().trim().min(1).max(2000).default("Review the latest conversation and assign the next step."),
  dueDate: dateOnlySchema.nullable().default(null),
  waitingOn: z.enum(HQ_WAITING_ON).default("haus"),
  archiveReason: z.string().max(1000).default(""),
  notes: z.string().max(10000).default(""),
  decisionStatus: z.enum(HQ_DECISION_STATUSES).default("none"),
  taskState: z.enum(HQ_TASK_STATES).default("open"),
}).passthrough();

export type HqRecordData = z.infer<typeof hqRecordDataSchema>;
export type HqChanges = z.infer<typeof hqChangesSchema>;
export type HqPatchInput = z.infer<typeof hqPatchSchema>;

export const hqImportSchema = z.object({
  mutationId: z.string().uuid(),
  records: z.array(z.object({
    id: z.string().max(240).regex(/^(instagram|tiktok|youtube|email|other):[a-z0-9][a-z0-9._@+\-]*$/, "Use a stable lowercase platform:handle identifier."),
    data: hqRecordDataSchema.refine((data) => data.stage !== "archived" || Boolean(data.archiveReason.trim()), "Archived records need an archive reason."),
  }).strict()).min(1).max(25),
}).strict().superRefine((input, context) => {
  const ids = new Set<string>();
  input.records.forEach((record, index) => {
    if (ids.has(record.id)) context.addIssue({ code: "custom", path: ["records", index, "id"], message: "Each creator identifier must occur once per import." });
    ids.add(record.id);
  });
});

export type HqImportInput = z.infer<typeof hqImportSchema>;
export type HqImportRecord = HqImportInput["records"][number];
export type HqImportResult = { created: number; skipped: number; records: { id: string; status: "created" | "existing" }[] };

export type HqRecordEnvelope = {
  id: string;
  creatorId: string | null;
  version: number;
  data: HqRecordData;
  createdAt: string;
  updatedAt: string;
};

export class HqValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HqValidationError";
  }
}

export function applyHqChanges(current: HqRecordData, untrustedChanges: unknown): HqRecordData {
  const changes = hqChangesSchema.parse(untrustedChanges);
  const next = hqRecordDataSchema.parse({ ...current, ...changes });
  if (next.stage === "archived" && !next.archiveReason.trim()) {
    throw new HqValidationError("Give a reason before archiving this relationship.");
  }
  // Restoring a card cannot lift an opt-out or restart outreach. A verified
  // consent change belongs in the source review workflow, not a board drag.
  if (current.doNotContact && current.stage === "archived" && next.stage !== "archived") {
    throw new HqValidationError("This creator is marked do not contact. Review consent evidence before restoring the card.");
  }
  return next;
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const expected = new URL(request.url).origin;
    const fetchSite = request.headers.get("sec-fetch-site");
    return new URL(origin).origin === expected && (!fetchSite || fetchSite === "same-origin");
  } catch {
    return false;
  }
}
