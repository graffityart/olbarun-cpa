import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

// Only run with a dedicated, disposable PostgreSQL database.
// Never use DATABASE_URL: this test intentionally creates and drops tables.
const url = process.env.SETTLEMENT_TEST_DATABASE_URL;
const enabled = process.env.SETTLEMENT_TEST_DB_CONFIRM === "disposable" &&
  process.env.NODE_ENV !== "production" &&
  url !== process.env.DATABASE_URL;
test("PostgreSQL row locks serialize competing settlement requests", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const table = "settlement_concurrency_test_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
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

test("PostgreSQL row locks prevent duplicate administrator payout", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const table = "settlement_payout_test_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ident = sql(table);
  try {
    await sql`create table ${ident} (id integer primary key, status text not null, payouts integer not null default 0)`;
    await sql`insert into ${ident} (id, status) values (1, 'APPROVED')`;
    const pay = () => sql.begin(async tx => {
      await tx`select id from ${ident} where id = 1 for update`;
      const [row] = await tx`select status from ${ident} where id = 1`;
      if (row.status !== "APPROVED") return "REJECTED";
      await tx`update ${ident} set status = 'PAID', payouts = payouts + 1 where id = 1`;
      return "PAID";
    });
    const outcomes = await Promise.all([pay(), pay()]);
    assert.deepEqual(outcomes.sort(), ["PAID", "REJECTED"]);
    const [row] = await sql`select status, payouts from ${ident} where id = 1`;
    assert.equal(row.status, "PAID");
    assert.equal(row.payouts, 1);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("failed payout transaction rolls back its state change", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const table = "settlement_rollback_test_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ident = sql(table);
  try {
    await sql`create table ${ident} (id integer primary key, status text not null)`;
    await sql`insert into ${ident} (id, status) values (1, 'APPROVED')`;
    await assert.rejects(sql.begin(async tx => {
      await tx`select id from ${ident} where id = 1 for update`;
      await tx`update ${ident} set status = 'PAID' where id = 1`;
      throw new Error("simulated payout failure");
    }), /simulated payout failure/);
    const [row] = await sql`select status from ${ident} where id = 1`;
    assert.equal(row.status, "APPROVED");
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("failed partner request rolls back pending state", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const table = "settlement_request_rollback_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ident = sql(table);
  try {
    await sql`create table ${ident} (partner_id integer primary key, pending boolean not null default false)`;
    await sql`insert into ${ident} (partner_id) values (1)`;
    await assert.rejects(sql.begin(async tx => {
      await tx`select partner_id from ${ident} where partner_id = 1 for update`;
      await tx`update ${ident} set pending = true where partner_id = 1`;
      throw new Error("simulated request failure");
    }), /simulated request failure/);
    const [row] = await sql`select pending from ${ident} where partner_id = 1`;
    assert.equal(row.pending, false);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("different partners can request settlements independently", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const table = "settlement_partner_isolation_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ident = sql(table);
  try {
    await sql`create table ${ident} (partner_id integer primary key, pending boolean not null default false)`;
    await sql`insert into ${ident} (partner_id) values (1), (2)`;
    const request = partnerId => sql.begin(async tx => {
      await tx`select partner_id from ${ident} where partner_id = ${partnerId} for update`;
      const [row] = await tx`select pending from ${ident} where partner_id = ${partnerId}`;
      if (row.pending) return "REJECTED";
      await tx`update ${ident} set pending = true where partner_id = ${partnerId}`;
      return "CREATED";
    });
    assert.deepEqual(await Promise.all([request(1), request(2)]), ["CREATED", "CREATED"]);
    const rows = await sql`select partner_id, pending from ${ident} order by partner_id`;
    assert.equal(rows.length, 2);
    assert.equal(rows.every(row => row.pending === true), true);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});
