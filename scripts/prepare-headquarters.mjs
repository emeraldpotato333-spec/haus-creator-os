import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { promisify } from "node:util";
import pg from "pg";

export const MIGRATION_NAME = "20261026000100_add_headquarters";
export const MIGRATION_SHA256 = "112921cfd639cad22ae9dd2caac1dbec4dca6dcc444265bd2265e7401de6687c";
const root = fileURLToPath(new URL("../", import.meta.url));
const migrationPath = resolve(root, "prisma/migrations", MIGRATION_NAME, "migration.sql");
const execFileAsync = promisify(execFile);

export class PreparationError extends Error {
  constructor(code) {
    super(code);
    this.name = "PreparationError";
    this.code = code;
  }
}

export function shouldPrepare(env) {
  return env.VERCEL === "1" && env.VERCEL_ENV === "production" && env.HQ_ENABLED === "true";
}

export function validateMigration(sql) {
  if (createHash("sha256").update(sql).digest("hex") !== MIGRATION_SHA256) {
    throw new PreparationError("MIGRATION_CHECKSUM_MISMATCH");
  }
}

const expectedColumns = {
  HqRecord: {
    id: ["text", "NO", null], creatorId: ["text", "YES", null], data: ["jsonb", "NO", null],
    version: ["integer", "NO", "1"], createdAt: ["timestamp without time zone", "NO", "CURRENT_TIMESTAMP"],
    updatedAt: ["timestamp without time zone", "NO", null],
  },
  HqAudit: {
    id: ["text", "NO", null], recordId: ["text", "NO", null], mutationId: ["text", "NO", null],
    actor: ["text", "NO", null], requestJson: ["jsonb", "NO", null], beforeJson: ["jsonb", "NO", null],
    afterJson: ["jsonb", "NO", null], createdAt: ["timestamp without time zone", "NO", "CURRENT_TIMESTAMP"],
  },
};

const expectedIndexes = {
  HqRecord_pkey: ["HqRecord", ["id"], true, true],
  HqRecord_updatedAt_idx: ["HqRecord", ["updatedAt"], false, false],
  HqRecord_creatorId_idx: ["HqRecord", ["creatorId"], false, false],
  HqAudit_pkey: ["HqAudit", ["id"], true, true],
  HqAudit_mutationId_key: ["HqAudit", ["mutationId"], true, false],
  HqAudit_recordId_createdAt_idx: ["HqAudit", ["recordId", "createdAt"], false, false],
};

export function validateExistingSchema(snapshot) {
  if (snapshot.tables.length !== 2 || snapshot.tables.some((table) => !["HqRecord", "HqAudit"].includes(table.name) || table.kind !== "r" || table.rls || table.forceRls)) {
    throw new PreparationError("HQ_TABLES_MISSING_OR_UNEXPECTED");
  }
  const expectedColumnCount = Object.values(expectedColumns).reduce((sum, columns) => sum + Object.keys(columns).length, 0);
  if (snapshot.columns.length !== expectedColumnCount) throw new PreparationError("HQ_COLUMN_DRIFT");
  for (const [table, columns] of Object.entries(expectedColumns)) {
    for (const [name, [type, nullable, defaultValue]] of Object.entries(columns)) {
      const column = snapshot.columns.find((item) => item.table === table && item.name === name);
      if (!column || column.type !== type || column.nullable !== nullable || column.defaultValue !== defaultValue || (type.startsWith("timestamp") && column.precision !== 3)) {
        throw new PreparationError("HQ_COLUMN_DRIFT");
      }
    }
  }
  if (snapshot.indexes.length !== Object.keys(expectedIndexes).length) throw new PreparationError("HQ_INDEX_DRIFT");
  for (const [name, [table, columns, unique, primary]] of Object.entries(expectedIndexes)) {
    const index = snapshot.indexes.find((item) => item.name === name);
    if (!index || index.table !== table || JSON.stringify(index.columns) !== JSON.stringify(columns) || index.unique !== unique || index.primary !== primary || !index.valid || !index.unconditional) {
      throw new PreparationError("HQ_INDEX_DRIFT");
    }
  }
  const constraints = snapshot.constraints;
  if (constraints.length !== 4 || !constraints.every((constraint) => constraint.validated)) throw new PreparationError("HQ_CONSTRAINT_DRIFT");
  for (const table of ["HqRecord", "HqAudit"]) {
    const key = constraints.find((item) => item.name === `${table}_pkey`);
    if (!key || key.table !== table || key.type !== "p" || normalizeConstraint(key.definition) !== "PRIMARYKEYid") throw new PreparationError("HQ_PRIMARY_KEY_DRIFT");
  }
  const positive = constraints.find((item) => item.name === "HqRecord_version_positive");
  if (!positive || positive.table !== "HqRecord" || positive.type !== "c" || normalizeConstraint(positive.definition) !== "CHECKversion>0") {
    throw new PreparationError("HQ_VERSION_CONSTRAINT_DRIFT");
  }
  const foreign = constraints.find((item) => item.name === "HqAudit_recordId_fkey");
  if (!foreign || foreign.table !== "HqAudit" || foreign.type !== "f" || foreign.referencesTable !== "HqRecord" || foreign.referencesSchema !== "public" || foreign.onDelete !== "r" || foreign.onUpdate !== "c" || JSON.stringify(foreign.columns) !== '["recordId"]' || JSON.stringify(foreign.referencesColumns) !== '["id"]') {
    throw new PreparationError("HQ_AUDIT_RELATION_DRIFT");
  }
  if (snapshot.triggers.length) throw new PreparationError("HQ_UNEXPECTED_TRIGGERS");
}

function normalizeConstraint(value) { return value.replace(/[\s"()]/g, ""); }

export async function readSchema(client) {
  const tables = (await client.query(`SELECT c.relname AS name, c.relkind AS kind, c.relrowsecurity AS rls, c.relforcerowsecurity AS "forceRls"
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('HqRecord','HqAudit')`)).rows;
  if (!tables.length) return { tables, columns: [], indexes: [], constraints: [], triggers: [] };
  const columns = (await client.query(`SELECT table_name AS "table", column_name AS name, data_type AS type, is_nullable AS nullable,
    column_default AS "defaultValue", datetime_precision AS precision FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('HqRecord','HqAudit')`)).rows;
  const indexes = (await client.query(`SELECT t.relname AS "table", i.relname AS name, ix.indisunique AS "unique", ix.indisprimary AS "primary",
    ix.indisvalid AS valid, ix.indpred IS NULL AS unconditional,
    ARRAY(SELECT a.attname::text FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum ORDER BY k.ord) AS columns
    FROM pg_index ix JOIN pg_class t ON t.oid=ix.indrelid JOIN pg_class i ON i.oid=ix.indexrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname IN ('HqRecord','HqAudit')`)).rows;
  const constraints = (await client.query(`SELECT t.relname AS "table", c.conname AS name, c.contype AS type, c.convalidated AS validated,
    pg_get_constraintdef(c.oid) AS definition, c.confdeltype AS "onDelete", c.confupdtype AS "onUpdate",
    rt.relname AS "referencesTable", rn.nspname AS "referencesSchema",
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum ORDER BY k.ord) AS columns,
    ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid=rt.oid AND a.attnum=k.attnum ORDER BY k.ord) AS "referencesColumns"
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    LEFT JOIN pg_class rt ON rt.oid=c.confrelid LEFT JOIN pg_namespace rn ON rn.oid=rt.relnamespace
    WHERE n.nspname='public' AND t.relname IN ('HqRecord','HqAudit') AND c.contype IN ('p','f','c','u','x')`)).rows;
  const triggers = (await client.query(`SELECT g.tgname AS name FROM pg_trigger g JOIN pg_class t ON t.oid=g.tgrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname IN ('HqRecord','HqAudit') AND NOT g.tgisinternal`)).rows;
  return { tables, columns, indexes, constraints, triggers };
}

async function migrationIsRecorded(client) {
  const exists = (await client.query(`SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS present`)).rows[0]?.present;
  if (!exists) return false;
  const result = await client.query(`SELECT checksum, finished_at, rolled_back_at FROM public."_prisma_migrations" WHERE migration_name=$1`, [MIGRATION_NAME]);
  const active = result.rows.filter((row) => !row.rolled_back_at);
  if (active.length > 1 || active.some((row) => !row.finished_at || row.checksum !== MIGRATION_SHA256)) {
    throw new PreparationError("HQ_MIGRATION_HISTORY_REQUIRES_REVIEW");
  }
  return active.length === 1;
}

async function resolvePrismaHistory(env) {
  // Official hotfix workflow: record this one verified migration as applied.
  // This does not execute SQL migrations or repair unrelated legacy history.
  try {
    await execFileAsync(process.execPath, [resolve(root, "node_modules/prisma/build/index.js"), "migrate", "resolve", "--applied", MIGRATION_NAME], {
      cwd: root, env, timeout: 45000, maxBuffer: 1024 * 1024,
    });
  } catch {
    // Another build may already have recorded it. The caller verifies the
    // exact finished checksum and fails closed if resolution did not succeed.
  }
}

export async function prepareHeadquarters({ env = process.env, clientFactory = (connectionString) => new pg.Client({ connectionString, connectionTimeoutMillis: 10000 }), resolveHistory = resolvePrismaHistory, readMigration = () => readFile(migrationPath, "utf8"), inspectSchema = readSchema } = {}) {
  if (!shouldPrepare(env)) return { status: "skipped" };
  if (!env.DATABASE_URL) throw new PreparationError("DATABASE_CONFIGURATION_MISSING");
  let databaseUrl;
  try { databaseUrl = new URL(env.DATABASE_URL); } catch { throw new PreparationError("DATABASE_CONFIGURATION_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol) || (databaseUrl.searchParams.has("schema") && databaseUrl.searchParams.get("schema") !== "public")) {
    throw new PreparationError("DATABASE_CONFIGURATION_UNSUPPORTED");
  }
  const sql = await readMigration();
  validateMigration(sql);
  const client = clientFactory(env.DATABASE_URL);
  let transaction = false;
  let applied = false;
  let recorded = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    transaction = true;
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL search_path = public");
    await client.query("SELECT pg_advisory_xact_lock(741913, 20261026)");
    recorded = await migrationIsRecorded(client);
    const before = await inspectSchema(client);
    if (!before.tables.length) {
      if (recorded) throw new PreparationError("HQ_HISTORY_WITHOUT_SCHEMA");
      await client.query(sql);
      applied = true;
    } else {
      validateExistingSchema(before);
    }
    validateExistingSchema(await inspectSchema(client));
    await client.query("COMMIT");
    transaction = false;
    if (!recorded) {
      await resolveHistory(env);
      recorded = await migrationIsRecorded(client);
      if (!recorded) throw new PreparationError("HQ_HISTORY_RECORDING_FAILED");
    }
    return { status: applied ? "applied" : "verified", migrationRecorded: recorded };
  } catch (error) {
    if (transaction) { try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ } }
    if (error instanceof PreparationError) throw error;
    // Never pass a connection string, SQL values, database error detail or
    // child-process output into public build logs.
    throw new PreparationError("HQ_SCHEMA_PREPARATION_FAILED");
  } finally {
    try { await client.end(); } catch { /* The build result is already determined. */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await prepareHeadquarters();
    console.log(`[headquarters] Schema preparation ${result.status}.`);
  } catch (error) {
    console.error(`[headquarters] Build stopped: ${error instanceof PreparationError ? error.code : "HQ_SCHEMA_PREPARATION_FAILED"}. No legacy migrations were run.`);
    process.exitCode = 1;
  }
}
