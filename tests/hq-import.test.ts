import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { POST } from "../src/app/api/headquarters/import/route";
import { createHqStore, type HqAuditEntry, type HqRepository, type HqTransaction } from "../src/lib/hq-store";
import { hqImportSchema, hqImportFileSchema, hqRecordDataSchema, type HqImportRecord, type HqRecordEnvelope } from "../src/lib/hq-validation";

const candidate = (handle = "sample_creator"): HqImportRecord => ({
  id: `instagram:${handle}`,
  data: hqRecordDataSchema.parse({
    name: "Sample creator", handle, cohort: "pilot", summary: "Source reviewed by William.",
    owner: "Agent", nextAction: "Prepare sample intake.",
    doNotContact: true, contactPolicy: "manual", evidence: [{ label: "Private source", url: "https://www.instagram.com/", observedAt: "2026-10-26", note: "No further outreach requested." }],
  }),
});

function memoryRepository(initial: HqImportRecord[] = [], failAuditAt = 0) {
  const row = (input: HqImportRecord): HqRecordEnvelope => ({ ...structuredClone(input), creatorId: null, version: 1, createdAt: "2026-10-26T19:00:00Z", updatedAt: "2026-10-26T19:00:00Z" });
  let records = new Map(initial.map((input) => [input.id, row(input)]));
  let audits: HqAuditEntry[] = [];
  let tail = Promise.resolve();
  const reader = {
    async readRecord(id: string) { return structuredClone(records.get(id) ?? null); },
    async readMutation(id: string) { return structuredClone(audits.find((entry) => entry.mutationId === id) ?? null); },
  };
  const repository: HqRepository = {
    ...reader,
    async listRecords() { return structuredClone([...records.values()]); },
    async probe() {},
    async transaction<T>(run: (tx: HqTransaction) => Promise<T>) {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const backup = structuredClone({ records, audits });
      try {
        return await run({
          ...reader,
          async compareAndSwap() { throw new Error("Import must never update an existing row."); },
          async createIfAbsent(input) {
            if (records.has(input.id)) return null;
            const created = row(input);
            records.set(input.id, created);
            return structuredClone(created);
          },
          async appendAudit(entry) {
            if (failAuditAt && audits.length + 1 === failAuditAt) throw new Error("Simulated audit failure");
            audits.push(structuredClone(entry));
          },
        });
      } catch (error) {
        records = backup.records;
        audits = backup.audits;
        throw error;
      } finally { release(); }
    },
  };
  return { repository, snapshot: () => structuredClone({ records, audits }) };
}

test("import creates missing records once and never overwrites existing consent or evidence", async () => {
  const existing = candidate("existing_creator");
  const memory = memoryRepository([existing]);
  const store = createHqStore(memory.repository);
  const newRecord = candidate("new_creator");
  const body = { mutationId: randomUUID(), records: [newRecord, { ...existing, data: { ...existing.data, doNotContact: false, evidence: [], notes: "Attempted replacement" } }] };
  const result = await store.importRecords(body);
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 1);
  assert.deepEqual(memory.snapshot().records.get(existing.id)?.data, existing.data);
  assert.equal(memory.snapshot().records.get(existing.id)?.version, 1);
  const audit = memory.snapshot().audits[0];
  assert.equal(audit.mutationId, `import:${body.mutationId}:${newRecord.id}`);
  assert.deepEqual(audit.beforeJson, { absent: true });
  assert.equal(audit.afterJson.version, 1);
  assert.equal(audit.actor, "shared-hq-user");
  const retry = await store.importRecords(body);
  assert.equal(retry.created, 0);
  assert.equal(retry.skipped, 2);
  assert.equal(memory.snapshot().audits.length, 1);
});

test("concurrent duplicate imports create one row and one audit", async () => {
  const memory = memoryRepository();
  const store = createHqStore(memory.repository);
  const body = { mutationId: randomUUID(), records: [candidate()] };
  const results = await Promise.all([store.importRecords(body), store.importRecords(body)]);
  assert.equal(results.reduce((sum, result) => sum + result.created, 0), 1);
  assert.equal(memory.snapshot().records.size, 1);
  assert.equal(memory.snapshot().audits.length, 1);
});

test("a malformed item rejects the complete batch before writing", async () => {
  const memory = memoryRepository();
  const store = createHqStore(memory.repository);
  await assert.rejects(store.importRecords({ mutationId: randomUUID(), records: [candidate(), { id: "instagram:second", data: { name: "Missing required identity" } }] }));
  assert.equal(memory.snapshot().records.size, 0);
  assert.equal(memory.snapshot().audits.length, 0);
});

test("an audit failure rolls back every new record in the batch", async () => {
  const memory = memoryRepository([], 2);
  const store = createHqStore(memory.repository);
  await assert.rejects(store.importRecords({ mutationId: randomUUID(), records: [candidate("first"), candidate("second")] }), /audit failure/);
  assert.equal(memory.snapshot().records.size, 0);
  assert.equal(memory.snapshot().audits.length, 0);
});

test("import rejects unknown controls, invalid IDs, duplicate identities and oversized batches", () => {
  const valid = { mutationId: randomUUID(), records: [candidate()] };
  for (const payload of [
    { ...valid, overwrite: true },
    { ...valid, records: [{ ...candidate(), creatorId: "link-without-proof" }] },
    { ...valid, records: [{ ...candidate(), id: "instagram:../private" }] },
    { ...valid, records: [{ ...candidate(), id: "https://example.com" }] },
    { ...valid, records: [candidate(), candidate()] },
    { ...valid, records: Array.from({ length: 26 }, (_, index) => candidate(`creator${index}`)) },
    { ...valid, records: [] },
  ]) assert.equal(hqImportSchema.safeParse(payload).success, false);
  assert.equal(hqImportSchema.safeParse(valid).success, true);
});

test("import rejects cross-origin and non-JSON requests before storage", async () => {
  const crossOrigin = await POST(new Request("https://hq.example.com/api/headquarters/import", { method: "POST", headers: { origin: "https://other.example.com", "content-type": "application/json" }, body: "{}" }));
  assert.equal(crossOrigin.status, 403);
  const nonJson = await POST(new Request("https://hq.example.com/api/headquarters/import", { method: "POST", headers: { origin: "https://hq.example.com", "content-type": "text/plain" }, body: "{}" }));
  assert.equal(nonJson.status, 415);
});

test("import remains unavailable until explicitly configured", async () => {
  const previous = process.env.HQ_ENABLED;
  process.env.HQ_ENABLED = "false";
  try {
    const response = await POST(new Request("https://hq.example.com/api/headquarters/import", { method: "POST", headers: { origin: "https://hq.example.com", "content-type": "application/json" }, body: JSON.stringify({ mutationId: randomUUID(), records: [candidate()] }) }));
    assert.equal(response.status, 503);
    assert.equal("records" in await response.json(), false);
  } finally {
    if (previous === undefined) delete process.env.HQ_ENABLED;
    else process.env.HQ_ENABLED = previous;
  }
});


test('large local migration files retain unique identities while server batches remain bounded', () => {
  const file = { mutationId: randomUUID(), records: Array.from({ length: 301 }, (_, i) => candidate(`migration${i}`)) };
  assert.equal(hqImportFileSchema.safeParse(file).success, true);
  assert.equal(hqImportSchema.safeParse(file).success, false);
  assert.equal(hqImportFileSchema.safeParse({ ...file, records: [...file.records, file.records[0]] }).success, false);
  assert.equal(hqImportFileSchema.safeParse({ ...file, records: Array.from({ length: 501 }, (_, i) => candidate(`migration${i}`)) }).success, false);
});
