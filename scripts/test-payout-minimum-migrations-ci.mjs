import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

// Disposable GitHub Actions PostgreSQL service only. Never accepts Neon or remote hosts.
assert.equal(process.env.CI, "true");
assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.PAYOUT_CI_SCHEMA_CONFIRM, "disposable-local-postgres");
const source = process.env.SETTLEMENT_TEST_DATABASE_URL;
assert.ok(source, "CI local Postgres URL required");
const u = new URL(source);
assert.ok(["postgres:", "postgresql:"].includes(u.protocol));
assert.ok(["localhost", "127.0.0.1"].includes(u.hostname), "Remote database forbidden");
assert.equal(u.port, "5432");
assert.equal(u.pathname, "/settlement_ci");
const admin = postgres(source, { max: 1, connect_timeout: 5 });
const dbName = "payout_migration_ci";
try {
  const exists = await admin`select 1 from pg_database where datname=${dbName}`;
  assert.equal(exists.length, 0, "Disposable database already exists; refusing reuse");
  await admin.unsafe(`CREATE DATABASE ${dbName}`);
} finally {
  await admin.end();
}
u.pathname = "/" + dbName;
const db = postgres(u.toString(), { max: 1, connect_timeout: 5 });
const files = [
  "0000_initial.sql",
  "0001_advertiser_users.sql",
  "0005_audit_logs.sql",
  "0006_login_attempts.sql",
  "0011_settlement_item_uniqueness.sql",
];
try {
  for (const file of files) {
    const contents = await readFile(join("db/migrations", file), "utf8");
    await db.unsafe(contents);
    console.log(`Applied ${file} to disposable CI database`);
  }
  const rows = await db`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`;
  const found = new Set(rows.map(r => r.table_name));
  const required = ["users", "partners", "advertisers", "advertiser_users", "earnings", "settlements", "settlement_items", "auth_sessions", "audit_logs", "login_attempts"];
  for (const table of required) assert.ok(found.has(table), `Missing table ${table}`);
  const indexes = await db`select indexname from pg_indexes where schemaname='public'`;
  assert.ok(indexes.some(x => x.indexname === "settlement_items_settlement_earning_unique"));
  console.log(JSON.stringify({ result: "pass", disposableDatabase: dbName, appliedMigrations: files, requiredTablesVerified: required.length, productionAccess: false }));
} finally {
  await db.end();
}
