import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { applyHqChanges, isCreatorConversation, hqUpdateBatchSchema, hqPatchSchema, hqRecordDataSchema, isSameOriginMutation, type HqRecordEnvelope } from "../src/lib/hq-validation";
import { createHqStore, HqStoreError, isHqConfigured, type HqAuditEntry, type HqRepository, type HqTransaction } from "../src/lib/hq-store";

const fixture = (): HqRecordEnvelope => ({
  id: "instagram:sample_creator",
  creatorId: null,
  version: 1,
  createdAt: "2026-10-26T19:00:00.000Z",
  updatedAt: "2026-10-26T19:00:00.000Z",
  data: hqRecordDataSchema.parse({
    name: "Sample Creator", handle: "sample_creator", cohort: "pilot", summary: "Awaiting project details.",
    stage: "conversation", owner: "Agent", nextAction: "Prepare sample intake.",
    doNotContact: false, contactPolicy: "manual", warmth: 3,
    evidence: [{ label: "Conversation", url: "https://www.instagram.com/", observedAt: "2026-10-26", note: "Samples discussed. No shipment verified." }],
    milestones: { sampleDispatched: null, agreementAccepted: null },
    shippingStatus: "William approval required", decisionReason: "Review freight estimate.",
    legacySendHistory: [{ id: "source-message-1", at: "2026-10-26" }],
  }),
});

// A transactional in-memory adapter exercises the same store entry point used
// by the API. PostgreSQL integration remains a separate deployment check.
function memoryRepository(initial = fixture(), failAudit = false) {
  let record = structuredClone(initial);
  let audits: HqAuditEntry[] = [];
  let tail = Promise.resolve();
  const reader = {
    async readRecord(id: string) { return id === record.id ? structuredClone(record) : null; },
    async readMutation(id: string) { return structuredClone(audits.find((entry) => entry.mutationId === id) ?? null); },
  };
  const repository: HqRepository = {
    ...reader,
    async listRecords() { return [structuredClone(record)]; },
    async probe() {},
    async transaction<T>(run: (tx: HqTransaction) => Promise<T>) {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const backup = structuredClone({ record, audits });
      try {
        return await run({
          ...reader,
          async compareAndSwap(id, version, data) {
            if (id !== record.id || version !== record.version) return null;
            record = { ...record, data: structuredClone(data), version: version + 1, updatedAt: "2026-10-26T20:00:00.000Z" };
            return structuredClone(record);
          },
          async createIfAbsent(candidate) {
            if (candidate.id === record.id) return null;
            throw new Error("Use the import repository fixture for new records.");
          },
          async appendAudit(entry) {
            if (failAudit) throw new Error("Simulated audit write failure");
            audits.push(structuredClone(entry));
          },
        });
      } catch (error) {
        record = backup.record;
        audits = backup.audits;
        throw error;
      } finally { release(); }
    },
  };
  return { repository, snapshot: () => structuredClone({ record, audits }) };
}

test("board changes cannot rewrite evidence, consent, commercial approval or delivery facts", () => {
  for (const changes of [
    { doNotContact: false }, { evidence: [] }, { sampleStatus: "delivered" }, { agreementStatus: "accepted" },
    { shippingStatus: "covered" }, { decisionStatus: "approved" }, { milestones: { sampleDispatched: "today" } },
    { legacySendHistory: [] }, { actor: "William" },
  ]) {
    assert.equal(hqPatchSchema.safeParse({ version: 1, mutationId: randomUUID(), changes }).success, false);
  }
  assert.equal(hqPatchSchema.safeParse({ version: 1, mutationId: randomUUID(), changes: {} }).success, false);
});

test("dragging a card and completing a planning task never infers shipment or acceptance", () => {
  const before = fixture().data;
  const after = applyHqChanges(before, { stage: "delivery", taskState: "done" });
  assert.equal(after.stage, "delivery");
  assert.equal(after.taskState, "done");
  assert.deepEqual(after.milestones, before.milestones);
  assert.deepEqual(after.evidence, before.evidence);
  assert.deepEqual(after.legacySendHistory, before.legacySendHistory);
  assert.equal(after.contactPolicy, "manual");
});

test("warmth and decision reasons are editable assessments while evidence and consent stay intact", () => {
  const before = fixture().data;
  const after = applyHqChanges(before, { warmth: 4, decisionReason: "Review a paid content rate card before making a proposal." });
  assert.equal(after.warmth, 4);
  assert.equal(after.decisionReason, "Review a paid content rate card before making a proposal.");
  assert.deepEqual(after.evidence, before.evidence);
  assert.deepEqual(after.milestones, before.milestones);
  assert.equal(after.doNotContact, before.doNotContact);
  assert.equal(after.shippingStatus, before.shippingStatus);
  assert.equal(applyHqChanges(after, { warmth: null }).warmth, null);
  for (const changes of [{ warmth: 0 }, { warmth: 6 }, { warmth: 2.5 }, { decisionReason: "x".repeat(5001) }]) {
    assert.throws(() => applyHqChanges(before, changes));
  }
});

test("archive requires a reason, preserves history and cannot lift a do-not-contact flag", () => {
  const before = fixture().data;
  assert.throws(() => applyHqChanges(before, { stage: "archived" }), /reason/);
  const archived = applyHqChanges({ ...before, doNotContact: true }, { stage: "archived", archiveReason: "Creator opted out." });
  assert.equal(archived.doNotContact, true);
  assert.deepEqual(archived.evidence, before.evidence);
  assert.deepEqual(archived.legacySendHistory, before.legacySendHistory);
  assert.throws(() => applyHqChanges(archived, { stage: "conversation" }), /consent evidence/);
  assert.equal(applyHqChanges(archived, { notes: "No further outreach." }).stage, "archived");
});

test("two concurrent stale writers cannot silently overwrite one another", async () => {
  const memory = memoryRepository();
  const store = createHqStore(memory.repository);
  const results = await Promise.allSettled([
    store.patch(fixture().id, { version: 1, mutationId: randomUUID(), changes: { nextAction: "Check freight." } }),
    store.patch(fixture().id, { version: 1, mutationId: randomUUID(), changes: { nextAction: "Collect square footage." } }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected?.status === "rejected" && rejected.reason instanceof HqStoreError);
  assert.equal(rejected.reason.code, "conflict");
  assert.equal(rejected.reason.current?.version, 2);
  const snapshot = memory.snapshot();
  assert.equal(snapshot.record.version, 2);
  assert.equal(snapshot.audits.length, 1);
  assert.ok("version" in snapshot.audits[0].beforeJson);
  assert.equal(snapshot.audits[0].beforeJson.version, 1);
  assert.equal(snapshot.audits[0].afterJson.version, 2);
  assert.equal(snapshot.audits[0].actor, "shared-hq-user");
});

test("an identical network retry is idempotent, but a reused ID with different content fails", async () => {
  const memory = memoryRepository();
  const store = createHqStore(memory.repository);
  const input = { version: 1, mutationId: randomUUID(), changes: { owner: "William" } };
  const results = await Promise.all([store.patch(fixture().id, input), store.patch(fixture().id, input)]);
  assert.equal(results.filter((result) => result.replayed).length, 1);
  assert.equal(memory.snapshot().audits.length, 1);
  assert.equal(memory.snapshot().record.version, 2);
  await assert.rejects(store.patch(fixture().id, { ...input, changes: { owner: "Agent" } }), (error: unknown) => error instanceof HqStoreError && error.code === "mutation_reused");
});

test("failed audit insertion rolls back the planning update", async () => {
  const memory = memoryRepository(fixture(), true);
  const store = createHqStore(memory.repository);
  await assert.rejects(store.patch(fixture().id, { version: 1, mutationId: randomUUID(), changes: { stage: "agreement" } }), /audit write failure/);
  assert.deepEqual(memory.snapshot().record, fixture());
  assert.equal(memory.snapshot().audits.length, 0);
});

test("mutation requests must be same-origin and dates must be real calendar dates", () => {
  const make = (origin?: string, site?: string) => new Request("https://hq.example.com/api/headquarters/a", { headers: { ...(origin ? { origin } : {}), ...(site ? { "sec-fetch-site": site } : {}) } });
  assert.equal(isSameOriginMutation(make("https://hq.example.com", "same-origin")), true);
  assert.equal(isSameOriginMutation(make()), false);
  assert.equal(isSameOriginMutation(make("null")), false);
  assert.equal(isSameOriginMutation(make("https://evil.example")), false);
  assert.equal(isSameOriginMutation(make("https://hq.example.com", "cross-site")), false);
  for (const dueDate of ["2026-02-29", "2026-13-01", "tomorrow"]) {
    assert.equal(hqPatchSchema.safeParse({ version: 1, mutationId: randomUUID(), changes: { dueDate } }).success, false);
  }
  assert.equal(hqPatchSchema.safeParse({ version: 1, mutationId: randomUUID(), changes: { dueDate: "2028-02-29" } }).success, true);
});

test("missing explicit configuration keeps the shared API disabled", () => {
  assert.equal(isHqConfigured({}), false);
  assert.equal(isHqConfigured({ DATABASE_URL: "postgres://example" }), false);
  assert.equal(isHqConfigured({ HQ_ENABLED: "true" }), false);
  assert.equal(isHqConfigured({ HQ_ENABLED: "false", DATABASE_URL: "postgres://example" }), false);
  assert.equal(isHqConfigured({ HQ_ENABLED: "true", DATABASE_URL: "postgres://example" }), true);
});


test("unknown and noncreator inbound never enter the creator conversation gate", () => {
  const before = fixture().data;
  assert.equal(before.relationshipType, "unclassified");
  assert.equal(isCreatorConversation(before), false);
  for (const relationshipType of ["customer", "trade", "other", "unclassified"] as const) {
    assert.equal(isCreatorConversation({...before, relationshipType, inboundIntent: "partnership"}), false);
  }
  assert.equal(isCreatorConversation({...before, relationshipType: "creator", inboundIntent: "product_question"}), false);
  assert.equal(isCreatorConversation({...before, relationshipType: "creator", inboundIntent: "partnership"}), true);
  assert.equal(isCreatorConversation({...before, relationshipType: "creator", inboundIntent: "partnership", doNotContact: true}), false);
});

test("source-backed refresh appends evidence while preserving consent and milestones", () => {
  const before = fixture().data;
  const source = {label:"Latest conversation",url:"https://www.instagram.com/direct/t/example/",observedAt:"2026-10-27T16:00:00-07:00",note:"Creator confirmed the sample choice."};
  const after = applyHqChanges(before,{observation:{source,fields:{relationshipType:"creator",inboundIntent:"partnership",summary:"Sample choice confirmed."}}});
  assert.equal(after.summary,"Sample choice confirmed.");
  assert.equal(after.verifiedAt,source.observedAt);
  assert.deepEqual(after.evidence,[...before.evidence!,source]);
  assert.deepEqual(after.milestones,before.milestones);
  assert.equal(after.contactPolicy,before.contactPolicy);
  assert.equal(after.doNotContact,before.doNotContact);
  assert.equal('observation' in after,false);
  for (const fields of [{doNotContact:false},{milestones:{}},{contactPolicy:"agent"},{evidence:[]}]) {
    assert.throws(()=>applyHqChanges(before,{observation:{source,fields}}));
  }
  assert.throws(()=>applyHqChanges(before,{observation:{source:{...source,url:'javascript:alert(1)'},fields:{summary:'Changed'}}}));
  assert.throws(()=>applyHqChanges(before,{observation:{fields:{summary:'Unattributed'}}}));
  assert.throws(()=>applyHqChanges({...before,evidence:Array(200).fill(source)},{observation:{source,fields:{summary:'New'}}}));
});

test("replaying a source refresh appends its history and audit only once", async () => {
 const memory=memoryRepository(); const store=createHqStore(memory.repository);
 const request={version:1,mutationId:randomUUID(),changes:{observation:{source:{label:'Reviewed thread',url:'https://www.instagram.com/',observedAt:'2026-10-27T16:00:00-07:00',note:'New project context.'},fields:{summary:'New project context.'}}}};
 await store.patch(fixture().id,request); await store.patch(fixture().id,request);
 assert.equal(memory.snapshot().record.data.evidence?.length,2);assert.equal(memory.snapshot().audits.length,1);
 assert.equal(hqUpdateBatchSchema.safeParse({updates:[{id:fixture().id,...request},{id:fixture().id,...request}]}).success,false);
});
