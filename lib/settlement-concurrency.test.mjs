import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

// Only run with a dedicated, disposable PostgreSQL database.
// Never use DATABASE_URL: this test intentionally creates and drops tables.
const url = process.env.SETTLEMENT_TEST_DATABASE_URL;
const enabled = process.env.SETTLEMENT_TEST_DB_CONFIRM === "disposable" &&
  process.env.NODE_ENV !== "production" &&
  url !== process.env.DATABASE_URL;
test("CI requires a dedicated PostgreSQL test database", () => {
  if (process.env.CI === "true") {
    assert.ok(url, "SETTLEMENT_TEST_DATABASE_URL is required in CI");
    assert.equal(enabled, true, "CI must use a confirmed non-production test database");
  }
});

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

test("rejected settlement restores earnings atomically", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const table = "settlement_reject_test_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ident = sql(table);
  try {
    await sql`create table ${ident} (id integer primary key, status text not null)`;
    await sql`insert into ${ident} (id, status) values (1, 'REQUESTED'), (2, 'HOLD')`;
    await sql.begin(async tx => {
      await tx`select id from ${ident} where id = 1 for update`;
      await tx`update ${ident} set status = 'REJECTED' where id = 1 and status = 'REQUESTED'`;
      await tx`update ${ident} set status = 'AVAILABLE' where id = 2 and status = 'HOLD'`;
    });
    const rows = await sql`select id, status from ${ident} order by id`;
    assert.deepEqual(rows.map(row => row.status), ["REJECTED", "AVAILABLE"]);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("failed settlement rejection rolls back both settlement and earning status", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const table = "settlement_reject_rollback_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ident = sql(table);
  try {
    await sql`create table ${ident} (id integer primary key, status text not null)`;
    await sql`insert into ${ident} (id, status) values (1, 'REQUESTED'), (2, 'HOLD')`;
    await assert.rejects(sql.begin(async tx => {
      await tx`select id from ${ident} where id = 1 for update`;
      await tx`update ${ident} set status = 'REJECTED' where id = 1`;
      await tx`update ${ident} set status = 'AVAILABLE' where id = 2`;
      throw new Error("simulated rejection failure");
    }), /simulated rejection failure/);
    const rows = await sql`select id, status from ${ident} order by id`;
    assert.deepEqual(rows.map(row => row.status), ["REQUESTED", "HOLD"]);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("CPA approval commits advertiser debit and partner earning together", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 3, prepare: false});
  const table = "cpa_approval_atomic_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ident = sql(table);
  try {
    await sql`create table ${ident} (id integer primary key, kind text not null, amount integer not null, status text not null)`;
    await sql`insert into ${ident} (id,kind,amount,status) values (1,'conversion',0,'REVIEWING')`;
    await sql.begin(async tx => {
      await tx`select id from ${ident} where id = 1 for update`;
      await tx`insert into ${ident} (id,kind,amount,status) values (2,'advertiser_debit',-30000,'POSTED'),(3,'partner_earning',20000,'AVAILABLE')`;
      await tx`update ${ident} set status = 'APPROVED' where id = 1 and status = 'REVIEWING'`;
    });
    const rows = await sql`select kind, amount, status from ${ident} order by id`;
    assert.deepEqual(rows.map(row => row.kind), ["conversion","advertiser_debit","partner_earning"]);
    assert.equal(rows[0].status,"APPROVED");
    assert.equal(rows[1].amount,-30000);
    assert.equal(rows[2].amount,20000);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("CPA approval failure rolls back both advertiser debit and partner earning", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 3, prepare: false});
  const table = "cpa_approval_rollback_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ident = sql(table);
  try {
    await sql`create table ${ident} (id integer primary key, kind text not null, amount integer not null, status text not null)`;
    await sql`insert into ${ident} (id,kind,amount,status) values (1,'conversion',0,'REVIEWING')`;
    await assert.rejects(sql.begin(async tx => {
      await tx`select id from ${ident} where id = 1 for update`;
      await tx`insert into ${ident} (id,kind,amount,status) values (2,'advertiser_debit',-30000,'POSTED')`;
      await tx`insert into ${ident} (id,kind,amount,status) values (3,'partner_earning',20000,'AVAILABLE')`;
      await tx`update ${ident} set status = 'APPROVED' where id = 1`;
      throw new Error("simulated approval failure");
    }), /simulated approval failure/);
    const rows = await sql`select kind,status from ${ident} order by id`;
    assert.equal(rows.length,1);
    assert.equal(rows[0].kind,"conversion");
    assert.equal(rows[0].status,"REVIEWING");
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("concurrent CPA approvals debit and credit exactly once", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const table = "cpa_concurrent_approval_" + process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ident = sql(table);
  try {
    await sql`create table ${ident} (id integer primary key, kind text not null, amount integer not null, status text not null)`;
    await sql`insert into ${ident} (id,kind,amount,status) values (1,'conversion',0,'REVIEWING')`;
    const approve = () => sql.begin(async tx => {
      await tx`select id from ${ident} where id = 1 for update`;
      const [conversion] = await tx`select status from ${ident} where id = 1`;
      if (conversion.status !== "REVIEWING") return "REJECTED";
      await tx`insert into ${ident} (id,kind,amount,status) values (2,'advertiser_debit',-30000,'POSTED'),(3,'partner_earning',20000,'AVAILABLE')`;
      await tx`update ${ident} set status = 'APPROVED' where id = 1 and status = 'REVIEWING'`;
      return "APPROVED";
    });
    const outcomes = await Promise.all([approve(), approve()]);
    assert.deepEqual(outcomes.sort(), ["APPROVED", "REJECTED"]);
    const rows = await sql`select kind, amount, status from ${ident} order by id`;
    assert.equal(rows.length, 3);
    assert.equal(rows[0].status, "APPROVED");
    assert.equal(rows[1].kind, "advertiser_debit");
    assert.equal(rows[1].amount, -30000);
    assert.equal(rows[2].kind, "partner_earning");
    assert.equal(rows[2].amount, 20000);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("concurrent CPA conversions cannot overspend one advertiser balance", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ledger = sql("cpa_balance_" + suffix);
  const conversions = sql("cpa_conversion_" + suffix);
  const earnings = sql("cpa_earning_" + suffix);
  try {
    await sql`create table ${ledger} (id integer primary key, advertiser_id integer not null, amount integer not null)`;
    await sql`create table ${conversions} (id integer primary key, status text not null)`;
    await sql`create table ${earnings} (conversion_id integer unique not null, amount integer not null)`;
    await sql`insert into ${ledger} (id, advertiser_id, amount) values (1, 10, 30000)`;
    await sql`insert into ${conversions} (id,status) values (1,'REVIEWING'),(2,'REVIEWING')`;
    const approve = id => sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('advertiser:10'))`;
      const [balance] = await tx`select coalesce(sum(amount),0)::integer as available from ${ledger} where advertiser_id=10`;
      if (balance.available < 20000) return "INSUFFICIENT_BALANCE";
      await tx`insert into ${ledger} (id,advertiser_id,amount) values (${id + 1},10,-20000)`;
      await tx`insert into ${earnings} (conversion_id,amount) values (${id},12000)`;
      await tx`update ${conversions} set status='APPROVED' where id=${id} and status='REVIEWING'`;
      return "APPROVED";
    });
    const outcomes = await Promise.all([approve(1),approve(2)]);
    assert.deepEqual(outcomes.sort(), ["APPROVED","INSUFFICIENT_BALANCE"]);
    const [balance] = await sql`select sum(amount)::integer as available from ${ledger}`;
    assert.equal(balance.available,10000);
    const [approved] = await sql`select count(*)::integer as total from ${conversions} where status='APPROVED'`;
    assert.equal(approved.total,1);
    const [earned] = await sql`select count(*)::integer as total,coalesce(sum(amount),0)::integer as amount from ${earnings}`;
    assert.equal(earned.total,1);
    assert.equal(earned.amount,12000);
  } finally {
    try { await sql`drop table if exists ${earnings}`; await sql`drop table if exists ${conversions}`; await sql`drop table if exists ${ledger}`; }
    finally { await sql.end(); }
  }
});
