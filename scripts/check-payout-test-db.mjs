import assert from "node:assert/strict";
import postgres from "postgres";

// Read-only identity check. Never runs migrations, seeds, notifications or payouts.
const url = process.env.PAYOUT_TEST_DATABASE_URL;
if (!url) throw new Error("PAYOUT_TEST_DATABASE_URL is required");
const parsed = new URL(url);
assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol), "PostgreSQL URL required");
assert.equal(parsed.pathname, "/mypickup_payout_test", "Only the dedicated payout test database is allowed");
assert.ok(parsed.username && parsed.password, "Dedicated test database credentials required");
assert.equal(parsed.searchParams.get("sslmode"), "require", "Explicit TLS requirement is mandatory");
assert.equal(parsed.hostname.endsWith(".neon.tech"), true, "Dedicated Neon hostname required");
assert.equal(parsed.port, "", "Unexpected database port");
assert.equal(process.env.PAYOUT_TEST_PROJECT_ID, "orange-salad-93665842", "Dedicated Neon project confirmation required");
assert.equal(process.env.PAYOUT_TEST_ISOLATION_CONFIRMED, "yes", "Explicit isolation confirmation required");
assert.notEqual(process.env.VERCEL_ENV, "production", "Production runtime is forbidden");
assert.notEqual(process.env.NODE_ENV, "production", "Production Node runtime is forbidden");
const productionUrl = process.env.DATABASE_URL;
if (productionUrl) {
  const prod = new URL(productionUrl);
  assert.notEqual(parsed.hostname.toLowerCase(), prod.hostname.toLowerCase(), "Test and application DB hosts must differ");
}
const sql = postgres(url, { max: 1, connect_timeout: 8, idle_timeout: 2 });
try {
  await sql`set default_transaction_read_only = on`;
  const [identity] = await sql`select current_database() as name, current_setting('server_version') as version`;
  assert.equal(identity.name, "mypickup_payout_test", "Connected to unexpected database");
  const [tables] = await sql`select count(*)::integer as count from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`;
  console.log(JSON.stringify({ database: identity.name, postgresVersion: identity.version, publicTableCount: tables.count, mode: "read-only" }));
} finally {
  await sql.end();
}
