import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MIGRATION_SHA256, prepareHeadquarters, shouldPrepare, validateExistingSchema, validateMigration } from "../scripts/prepare-headquarters.mjs";

const sql = await readFile(new URL("../prisma/migrations/20261026000100_add_headquarters/migration.sql", import.meta.url), "utf8");
const activeEnv = { VERCEL: "1", VERCEL_ENV: "production", HQ_ENABLED: "true", DATABASE_URL: "postgres://user:private-value@example.invalid/test" };

function expectedSchema() {
  const columns = [];
  const add = (table, name, type, nullable = "NO", defaultValue = null) => columns.push({ table, name, type, nullable, defaultValue, precision: type.startsWith("timestamp") ? 3 : null });
  for (const name of ["id", "creatorId"]) add("HqRecord", name, "text", name === "creatorId" ? "YES" : "NO");
  add("HqRecord", "data", "jsonb"); add("HqRecord", "version", "integer", "NO", "1");
  add("HqRecord", "createdAt", "timestamp without time zone", "NO", "CURRENT_TIMESTAMP"); add("HqRecord", "updatedAt", "timestamp without time zone");
  for (const name of ["id", "recordId", "mutationId", "actor"]) add("HqAudit", name, "text");
  for (const name of ["requestJson", "beforeJson", "afterJson"]) add("HqAudit", name, "jsonb");
  add("HqAudit", "createdAt", "timestamp without time zone", "NO", "CURRENT_TIMESTAMP");
  const index = (table, name, columnNames, unique = false, primary = false) => ({ table, name, columns: columnNames, unique, primary, valid: true, unconditional: true });
  return {
    tables: ["HqRecord", "HqAudit"].map((name) => ({ name, kind: "r", rls: false, forceRls: false })),
    columns,
    indexes: [index("HqRecord", "HqRecord_pkey", ["id"], true, true), index("HqAudit", "HqAudit_pkey", ["id"], true, true), index("HqRecord", "HqRecord_updatedAt_idx", ["updatedAt"]), index("HqRecord", "HqRecord_creatorId_idx", ["creatorId"]), index("HqAudit", "HqAudit_mutationId_key", ["mutationId"], true), index("HqAudit", "HqAudit_recordId_createdAt_idx", ["recordId", "createdAt"])],
    constraints: [
      ...["HqRecord", "HqAudit"].map((table) => ({ table, name: `${table}_pkey`, type: "p", validated: true, definition: 'PRIMARY KEY ("id")' })),
      { table: "HqRecord", name: "HqRecord_version_positive", type: "c", validated: true, definition: "CHECK ((version > 0))" },
      { table: "HqAudit", name: "HqAudit_recordId_fkey", type: "f", validated: true, definition: "unused", referencesTable: "HqRecord", referencesSchema: "public", onDelete: "r", onUpdate: "c", columns: ["recordId"], referencesColumns: ["id"] },
    ],
    triggers: [],
  };
}

function fakeDatabase({ existing = false, recorded = existing, before, after, historyChecksum = MIGRATION_SHA256, resolveFails = false } = {}) {
  const queries = [];
  let created = existing;
  let resolved = recorded;
  let resolutionCalls = 0;
  const client = {
    async connect() { queries.push("CONNECT"); },
    async end() { queries.push("END"); },
    async query(query) {
      queries.push(query);
      if (query.includes("to_regclass")) return { rows: [{ present: resolved }] };
      if (query.includes("FROM public.\"_prisma_migrations\"")) return { rows: resolved ? [{ checksum: historyChecksum, finished_at: new Date(), rolled_back_at: null }] : [] };
      if (query === sql) { created = true; return { rows: [] }; }
      if (/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL |SELECT pg_advisory_xact_lock)/.test(query)) return { rows: [] };
      throw new Error("Unexpected query in preparation");
    },
  };
  return {
    queries,
    resolutionCalls: () => resolutionCalls,
    options: {
      env: activeEnv, clientFactory: () => client, readMigration: async () => sql,
      inspectSchema: async () => created ? (after ?? before ?? expectedSchema()) : (before ?? { tables: [], columns: [], indexes: [], constraints: [], triggers: [] }),
      resolveHistory: async () => { resolutionCalls += 1; if (!resolveFails) resolved = true; },
    },
  };
}

test("only explicitly enabled Vercel production builds can connect", async () => {
  for (const env of [{}, { ...activeEnv, VERCEL_ENV: "preview" }, { ...activeEnv, HQ_ENABLED: "false" }, { ...activeEnv, VERCEL: undefined }]) {
    assert.equal(shouldPrepare(env), false);
    const result = await prepareHeadquarters({ env, clientFactory: () => { throw new Error("Must not connect"); } });
    assert.equal(result.status, "skipped");
  }
  assert.equal(shouldPrepare(activeEnv), true);
  await assert.rejects(prepareHeadquarters({ env: { ...activeEnv, DATABASE_URL: undefined } }), /DATABASE_CONFIGURATION_MISSING/);
});

test("the exact reviewed migration is hash pinned", () => {
  assert.doesNotThrow(() => validateMigration(sql));
  assert.throws(() => validateMigration(`${sql}\nDROP TABLE "Creator";`), /MIGRATION_CHECKSUM_MISMATCH/);
  assert.throws(() => validateMigration(sql.replace("RESTRICT", "CASCADE")), /MIGRATION_CHECKSUM_MISMATCH/);
});

test("schema drift is rejected for nullable fields, weaker indexes, cascade deletion or triggers", () => {
  assert.doesNotThrow(() => validateExistingSchema(expectedSchema()));
  const mutations = [
    (state) => { state.tables.pop(); },
    (state) => { state.tables[0].kind = "v"; },
    (state) => { state.columns.find((column) => column.name === "version").nullable = "YES"; },
    (state) => { state.indexes.find((index) => index.name === "HqAudit_mutationId_key").unique = false; },
    (state) => { state.constraints.find((constraint) => constraint.type === "f").onDelete = "c"; },
    (state) => { state.constraints.find((constraint) => constraint.type === "c").definition = "CHECK (version >= 0)"; },
    (state) => { state.triggers.push({ name: "unexpected_sender" }); },
  ];
  for (const mutate of mutations) {
    const state = expectedSchema(); mutate(state);
    assert.throws(() => validateExistingSchema(state));
  }
});

test("new schema uses advisory-locked transaction, verifies, commits, then records only this migration", async () => {
  const db = fakeDatabase();
  const result = await prepareHeadquarters(db.options);
  assert.deepEqual(result, { status: "applied", migrationRecorded: true });
  assert.equal(db.queries.filter((query) => query === sql).length, 1);
  assert.ok(db.queries.indexOf("BEGIN") < db.queries.indexOf(sql));
  assert.ok(db.queries.findIndex((query) => query.startsWith("SELECT pg_advisory_xact_lock")) < db.queries.indexOf(sql));
  assert.ok(db.queries.indexOf(sql) < db.queries.indexOf("COMMIT"));
  assert.equal(db.resolutionCalls(), 1);
});

test("existing exact schema and migration history are read-only on repeat builds", async () => {
  const db = fakeDatabase({ existing: true });
  const result = await prepareHeadquarters(db.options);
  assert.deepEqual(result, { status: "verified", migrationRecorded: true });
  assert.equal(db.queries.includes(sql), false);
  assert.equal(db.resolutionCalls(), 0);
});

test("partial schema and unexpected history stop without applying DDL", async () => {
  const partial = expectedSchema(); partial.tables.pop();
  for (const db of [fakeDatabase({ before: partial }), fakeDatabase({ existing: true, historyChecksum: "wrong" })]) {
    await assert.rejects(prepareHeadquarters(db.options));
    assert.equal(db.queries.includes(sql), false);
    assert.equal(db.queries.includes("COMMIT"), false);
    assert.equal(db.queries.includes("ROLLBACK"), true);
    assert.equal(db.resolutionCalls(), 0);
  }
});

test("failed post-migration validation rolls back rather than publishing a partial schema", async () => {
  const wrong = expectedSchema(); wrong.indexes.pop();
  const db = fakeDatabase({ after: wrong });
  await assert.rejects(prepareHeadquarters(db.options), /HQ_INDEX_DRIFT/);
  assert.equal(db.queries.includes(sql), true);
  assert.equal(db.queries.includes("COMMIT"), false);
  assert.equal(db.queries.includes("ROLLBACK"), true);
  assert.equal(db.resolutionCalls(), 0);
});

test("unresolved migration history fails the build, and connection errors never include secrets", async () => {
  const db = fakeDatabase({ resolveFails: true });
  await assert.rejects(prepareHeadquarters(db.options), /HQ_HISTORY_RECORDING_FAILED/);
  await assert.rejects(prepareHeadquarters({ env: activeEnv, readMigration: async () => sql, clientFactory: () => ({ async connect() { throw new Error(activeEnv.DATABASE_URL); }, async end() {} }) }), (error) => error.message === "HQ_SCHEMA_PREPARATION_FAILED" && !error.message.includes("private-value"));
});
