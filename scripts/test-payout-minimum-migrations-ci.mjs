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
  // Verify that the uniqueness migration actually rejects duplicate settlement/earning pairs.
  // A rolled-back transaction leaves the disposable database clean.
  await db.begin(async tx => {
    const [user] = await tx`insert into users(email,password_hash,role,status) values ('ci-payout@synthetic.invalid','not-a-real-login','PARTNER','ACTIVE') returning id`;
    const [partner] = await tx`insert into partners(user_id,partner_code,name) values (${user.id},'CI-PAYOUT-PARTNER','CI test') returning id`;
    const [earning] = await tx`insert into earnings(partner_id,amount,status) values (${partner.id},10000,'AVAILABLE') returning id`;
    const [settlement] = await tx`insert into settlements(settlement_code,partner_id,requested_amount,deduction_amount,payment_amount,status,bank_account_snapshot) values ('CI-PAYOUT-SETTLEMENT',${partner.id},10000,0,10000,'REQUESTED','{}'::jsonb) returning id`;
    await tx`insert into settlement_items(settlement_id,earning_id,amount) values (${settlement.id},${earning.id},10000)`;
    await assert.rejects(
      tx.savepoint(async sp => {
        await sp`insert into settlement_items(settlement_id,earning_id,amount) values (${settlement.id},${earning.id},10000)`;
      }),
      error => error?.code === "23505",
      "Duplicate settlement/earning pair must violate unique index",
    );
    const [count] = await tx`select count(*)::int as n from settlement_items where settlement_id=${settlement.id}`;
    assert.equal(count.n, 1, "Failed duplicate insert must not corrupt transaction");
    throw Object.assign(new Error("EXPECTED_CI_ROLLBACK"), { expectedRollback: true });
  }).catch(error => {
    if (!error?.expectedRollback) throw error;
  });
  const [rolledBack] = await db`select count(*)::int as n from users where email='ci-payout@synthetic.invalid'`;
  assert.equal(rolledBack.n, 0, "Rollback must remove all synthetic rows");
  console.log("Unique settlement item constraint and transaction rollback verified");
  console.log(JSON.stringify({ result: "pass", disposableDatabase: dbName, appliedMigrations: files, requiredTablesVerified: required.length, productionAccess: false }));
} finally {
  await db.end();
}
