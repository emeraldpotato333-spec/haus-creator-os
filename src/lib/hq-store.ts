import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  applyHqChanges,
  hqImportSchema,
  hqPatchSchema,
  hqRecordDataSchema,
  type HqPatchInput,
  type HqRecordData,
  type HqRecordEnvelope,
  type HqImportRecord,
  type HqImportResult,
} from "@/lib/hq-validation";

export class HqStoreError extends Error {
  constructor(public readonly code: "unavailable" | "not_found" | "conflict" | "mutation_reused", message: string, public readonly current?: HqRecordEnvelope) {
    super(message);
    this.name = "HqStoreError";
  }
}

export type HqAuditEntry = {
  recordId: string;
  mutationId: string;
  actor: string;
  requestJson: HqPatchInput | { operation: "import"; batchMutationId: string; record: HqImportRecord };
  beforeJson: HqRecordEnvelope | { absent: true };
  afterJson: HqRecordEnvelope;
};

export interface HqTransaction {
  readRecord(id: string): Promise<HqRecordEnvelope | null>;
  readMutation(mutationId: string): Promise<Pick<HqAuditEntry, "recordId" | "requestJson"> | null>;
  compareAndSwap(id: string, version: number, data: HqRecordData): Promise<HqRecordEnvelope | null>;
  createIfAbsent(record: HqImportRecord): Promise<HqRecordEnvelope | null>;
  appendAudit(entry: HqAuditEntry): Promise<void>;
}

export interface HqRepository extends Pick<HqTransaction, "readRecord" | "readMutation"> {
  listRecords(): Promise<HqRecordEnvelope[]>;
  transaction<T>(run: (tx: HqTransaction) => Promise<T>): Promise<T>;
  probe(): Promise<void>;
}

// This core has no transport or delivery side effects. The only mutation is a
// versioned planning record plus its audit entry in the same transaction.
export function createHqStore(repository: HqRepository) {
  async function replay(id: string, input: HqPatchInput, source: Pick<HqTransaction, "readRecord" | "readMutation">) {
    const prior = await source.readMutation(input.mutationId);
    if (!prior) return null;
    if (prior.recordId !== id || canonicalJson(prior.requestJson) !== canonicalJson(input)) {
      throw new HqStoreError("mutation_reused", "This save identifier was already used for a different change. Reload before saving again.");
    }
    const record = await source.readRecord(id);
    if (!record) throw new HqStoreError("not_found", "Creator record not found.");
    return { record, replayed: true };
  }

  return {
    list: () => repository.listRecords(),
    get: (id: string) => repository.readRecord(id),
    probe: () => repository.probe(),
    async importRecords(untrustedInput: unknown): Promise<HqImportResult> {
      const input = hqImportSchema.parse(untrustedInput);
      return repository.transaction(async (tx) => {
        const records: HqImportResult["records"] = [];
        // Consistent lock order avoids two overlapping imports acquiring
        // unique-index locks in opposite orders.
        for (const candidate of [...input.records].sort((a, b) => a.id.localeCompare(b.id))) {
          const record = await tx.createIfAbsent(candidate);
          if (!record) {
            records.push({ id: candidate.id, status: "existing" });
            continue;
          }
          await tx.appendAudit({
            recordId: record.id,
            mutationId: `import:${input.mutationId}:${record.id}`,
            actor: "shared-hq-user",
            requestJson: { operation: "import", batchMutationId: input.mutationId, record: candidate },
            beforeJson: { absent: true },
            afterJson: record,
          });
          records.push({ id: record.id, status: "created" });
        }
        const created = records.filter((record) => record.status === "created").length;
        return { created, skipped: records.length - created, records };
      });
    },
    async patch(id: string, untrustedInput: unknown) {
      const input = hqPatchSchema.parse(untrustedInput);
      try {
        return await repository.transaction(async (tx) => {
          const previous = await replay(id, input, tx);
          if (previous) return previous;
          const current = await tx.readRecord(id);
          if (!current) throw new HqStoreError("not_found", "Creator record not found.");
          if (current.version !== input.version) {
            throw new HqStoreError("conflict", "Someone else changed this card. Review the latest version before saving.", current);
          }
          const nextData = applyHqChanges(current.data, input.changes);
          const record = await tx.compareAndSwap(id, input.version, nextData);
          if (!record) throw new HqStoreError("conflict", "Someone else changed this card. Review the latest version before saving.");
          await tx.appendAudit({
            recordId: id,
            mutationId: input.mutationId,
            // A protected shared session is not proof of an individual author.
            actor: "shared-hq-user",
            requestJson: input,
            beforeJson: current,
            afterJson: record,
          });
          return { record, replayed: false };
        });
      } catch (error) {
        if ((error instanceof HqStoreError && error.code === "conflict") || hasPrismaCode(error, "P2002")) {
          // Concurrent identical retries may reach the database before the
          // first transaction commits. Resolve them from its committed audit.
          const previous = await replay(id, input, repository);
          if (previous) return previous;
          const current = await repository.readRecord(id);
          throw new HqStoreError("conflict", "Someone else changed this card. Review the latest version before saving.", current ?? undefined);
        }
        throw error;
      }
    },
  };
}

export function isHqConfigured(env: { HQ_ENABLED?: string; DATABASE_URL?: string } = { HQ_ENABLED: process.env.HQ_ENABLED, DATABASE_URL: process.env.DATABASE_URL }) {
  return env.HQ_ENABLED === "true" && Boolean(env.DATABASE_URL);
}

export function getHqStore() {
  if (!isHqConfigured()) {
    throw new HqStoreError("unavailable", "Shared headquarters is not configured yet.");
  }
  return createHqStore(createPrismaRepository());
}

function createPrismaRepository(): HqRepository {
  const prisma = getPrisma();
  const makeReader = (db: Pick<Prisma.TransactionClient, "hqRecord" | "hqAudit">) => ({
    async readRecord(id: string) {
      const record = await db.hqRecord.findUnique({ where: { id } });
      return record ? envelope(record) : null;
    },
    async readMutation(mutationId: string) {
      const audit = await db.hqAudit.findUnique({ where: { mutationId }, select: { recordId: true, requestJson: true } });
      if (!audit) return null;
      // PATCH keys are UUIDs; import audit keys use an explicit import prefix.
      // Keeping these namespaces separate avoids cross-operation replays.
      return { recordId: audit.recordId, requestJson: hqPatchSchema.parse(audit.requestJson) };
    },
  });

  return {
    ...makeReader(prisma),
    async listRecords() {
      return (await prisma.hqRecord.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] })).map(envelope);
    },
    async probe() {
      // Selecting one identifier checks the additive schema without returning
      // creator details or database configuration to the health caller.
      await prisma.hqRecord.findFirst({ select: { id: true } });
    },
    transaction: (run) => prisma.$transaction(async (tx) => run({
      ...makeReader(tx),
      async compareAndSwap(id, version, data) {
        const result = await tx.hqRecord.updateMany({ where: { id, version }, data: { data: json(data), version: { increment: 1 } } });
        if (result.count !== 1) return null;
        const record = await tx.hqRecord.findUniqueOrThrow({ where: { id } });
        return envelope(record);
      },
      async createIfAbsent(candidate) {
        const result = await tx.hqRecord.createMany({
          data: [{ id: candidate.id, creatorId: null, data: json(candidate.data), version: 1 }],
          skipDuplicates: true,
        });
        if (result.count !== 1) return null;
        return envelope(await tx.hqRecord.findUniqueOrThrow({ where: { id: candidate.id } }));
      },
      async appendAudit(entry) {
        await tx.hqAudit.create({ data: {
          recordId: entry.recordId,
          mutationId: entry.mutationId,
          actor: entry.actor,
          requestJson: json(entry.requestJson),
          beforeJson: json(entry.beforeJson),
          afterJson: json(entry.afterJson),
        } });
      },
    })),
  };
}

function envelope(record: { id: string; creatorId: string | null; version: number; data: unknown; createdAt: Date; updatedAt: Date }): HqRecordEnvelope {
  return {
    id: record.id,
    creatorId: record.creatorId,
    version: record.version,
    data: hqRecordDataSchema.parse(record.data),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasPrismaCode(error: unknown, code: string) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}
