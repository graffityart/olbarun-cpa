import assert from "node:assert/strict";
import postgres from "postgres";

// Dedicated synthetic database schema inventory; no writes, no secrets in output.
const url = process.env.PAYOUT_TEST_DATABASE_URL;
assert.ok(url, "PAYOUT_TEST_DATABASE_URL required");
const u = new URL(url);
assert.ok(["postgres:", "postgresql:"].includes(u.protocol), "Postgres required");
assert.equal(u.pathname, "/mypickup_payout_test", "Wrong test database");
assert.ok(u.username && u.password, "Dedicated test DB credentials required");
assert.equal(u.port, "", "Unexpected test database port");
assert.ok(u.hostname.endsWith(".neon.tech"), "Neon hostname required");
assert.equal(u.searchParams.get("sslmode"), "require", "TLS required");
assert.equal(process.env.PAYOUT_TEST_PROJECT_ID, "orange-salad-93665842");
assert.equal(process.env.PAYOUT_TEST_ISOLATION_CONFIRMED, "yes");
assert.notEqual(process.env.NODE_ENV, "production");
assert.notEqual(process.env.VERCEL_ENV, "production");
if (process.env.DATABASE_URL) assert.notEqual(u.hostname.toLowerCase(), new URL(process.env.DATABASE_URL).hostname.toLowerCase(), "Shared DB host forbidden");
const sql = postgres(url, { max: 1, connect_timeout: 8, idle_timeout: 2 });
try {
  await sql`set default_transaction_read_only = on`;
  const [identity] = await sql`select current_database() as name`;
  assert.equal(identity.name, "mypickup_payout_test");
  const tables = await sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`;
  const required = ["users", "partners", "advertisers", "advertiser_users", "notifications", "earnings", "settlements", "settlement_items", "auth_sessions", "audit_logs", "login_attempts"];
  const names = new Set(tables.map(x => x.table_name));
  const missing = required.filter(name => !names.has(name));
  const indexes = await sql`select indexname from pg_indexes where schemaname='public'`;
  const uniqueIndexReady = indexes.some(x => x.indexname === "settlement_items_settlement_earning_unique");
  console.log(JSON.stringify({ database: identity.name, totalTables: tables.length, requiredTables: required, missingTables: missing, uniqueIndexReady, schemaReady: missing.length === 0 && uniqueIndexReady }));
  if (missing.length || !uniqueIndexReady) process.exitCode = 2;
} finally {
  await sql.end();
}
