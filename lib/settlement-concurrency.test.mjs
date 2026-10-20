import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

// Only run with a dedicated, disposable PostgreSQL database.
// Never use DATABASE_URL: this test intentionally creates and drops tables.
const url = process.env.SETTLEMENT_TEST_DATABASE_URL;
const enabled = process.env.SETTLEMENT_TEST_DB_CONFIRM === "disposable";
test("PostgreSQL row locks serialize competing settlement requests", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const table = "settlement_concurrency_test_" + process.pid;
  const ident = sql(table);
  try {
    await sql`create table ${ident} (partner_id integer primary key, pending boolean not null default false)`;
    await sql`insert into ${ident} (partner_id) values (1)`;
    const request = () => sql.begin(async tx => {
      await tx`select partner_id from ${ident} where partner_id = 1 for update`;
      const [row] = await tx`select pending from ${ident} where partner_id = 1`;
      if (row.pending) return "REJECTED";
      await tx`update ${ident} set pending = true where partner_id = 1`;
      return "CREATED";
    });
    const outcomes = await Promise.all([request(), request()]);
    assert.deepEqual(outcomes.sort(), ["CREATED", "REJECTED"]);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});
