import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

// Only run with a dedicated, disposable PostgreSQL database.
// Never use DATABASE_URL: this test intentionally creates and drops tables.
const url = process.env.SETTLEMENT_TEST_DATABASE_URL;
const testDatabase = (() => { try { return url ? new URL(url) : null; } catch { return null; } })();
const dbName = testDatabase?.pathname.slice(1).toLowerCase() ?? "";
const enabled = process.env.SETTLEMENT_TEST_DB_CONFIRM === "disposable" &&
  process.env.NODE_ENV === "test" &&
  testDatabase !== null &&
  ["postgres:", "postgresql:"].includes(testDatabase.protocol) &&
  /(?:test|disposable|ci)/.test(dbName) &&
  ["localhost", "127.0.0.1", "::1"].includes(testDatabase.hostname) &&
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


test("CPA approval rollback leaves no debit or earning on failure", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const ledger = sql("cpa_rollback_balance_" + suffix);
  const conversions = sql("cpa_rollback_conversion_" + suffix);
  const earnings = sql("cpa_rollback_earning_" + suffix);
  try {
    await sql`create table ${ledger} (id integer primary key, advertiser_id integer not null, amount integer not null)`;
    await sql`create table ${conversions} (id integer primary key, status text not null)`;
    await sql`create table ${earnings} (conversion_id integer unique not null, amount integer not null)`;
    await sql`insert into ${ledger} (id, advertiser_id, amount) values (1,10,30000)`;
    await sql`insert into ${conversions} (id,status) values (1,'REVIEWING')`;
    await assert.rejects(sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('advertiser:10'))`;
      await tx`insert into ${ledger} (id,advertiser_id,amount) values (2,10,-20000)`;
      await tx`insert into ${earnings} (conversion_id,amount) values (1,12000)`;
      await tx`update ${conversions} set status='APPROVED' where id=1`;
      throw new Error("SIMULATED_AUDIT_FAILURE");
    }), /SIMULATED_AUDIT_FAILURE/);
    const [balance] = await sql`select sum(amount)::integer as available,count(*)::integer as total from ${ledger}`;
    assert.equal(balance.available,30000);
    assert.equal(balance.total,1);
    const [earned] = await sql`select count(*)::integer as total from ${earnings}`;
    assert.equal(earned.total,0);
    const [conversion] = await sql`select status from ${conversions} where id=1`;
    assert.equal(conversion.status,"REVIEWING");
  } finally {
    try { await sql`drop table if exists ${earnings}`; await sql`drop table if exists ${conversions}`; await sql`drop table if exists ${ledger}`; }
    finally { await sql.end(); }
  }
});

test("posting review advisory lock makes duplicate approvals idempotent", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const submissions = sql("posting_review_submissions_test_" + suffix);
  const ledger = sql("posting_review_ledger_test_" + suffix);
  const earnings = sql("posting_review_earnings_test_" + suffix);
  try {
    await sql`create table ${submissions} (id integer primary key, status text not null)`;
    await sql`create table ${ledger} (submission_id integer unique not null, amount integer not null)`;
    await sql`create table ${earnings} (submission_id integer unique not null, amount integer not null)`;
    await sql`insert into ${submissions} (id,status) values (1,'SUBMITTED')`;
    const approve = () => sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('posting:1'))`;
      const [row] = await tx`select status from ${submissions} where id=1`;
      if (row.status === "APPROVED") return "ALREADY_APPROVED";
      assert.equal(row.status, "SUBMITTED");
      await tx`insert into ${ledger} (submission_id,amount) values (1,-1000)`;
      await tx`insert into ${earnings} (submission_id,amount) values (1,700)`;
      await tx`update ${submissions} set status='APPROVED' where id=1`;
      return "APPROVED";
    });
    assert.deepEqual((await Promise.all([approve(),approve()])).sort(),["ALREADY_APPROVED","APPROVED"]);
    const [charges] = await sql`select count(*)::int as total, sum(amount)::int as amount from ${ledger}`;
    const [rewards] = await sql`select count(*)::int as total, sum(amount)::int as amount from ${earnings}`;
    assert.deepEqual(charges,{total:1,amount:-1000});
    assert.deepEqual(rewards,{total:1,amount:700});
  } finally {
    try { await sql`drop table if exists ${earnings}`; await sql`drop table if exists ${ledger}`; await sql`drop table if exists ${submissions}`; }
    finally { await sql.end(); }
  }
});

test("posting approval transaction rollback leaves no charge or reward", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const submissions = sql("posting_rollback_submissions_test_" + suffix);
  const ledger = sql("posting_rollback_ledger_test_" + suffix);
  try {
    await sql`create table ${submissions} (id integer primary key, status text not null)`;
    await sql`create table ${ledger} (submission_id integer unique not null, amount integer not null)`;
    await sql`insert into ${submissions} (id,status) values (1,'SUBMITTED')`;
    await assert.rejects(sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('posting:rollback:1'))`;
      await tx`insert into ${ledger} (submission_id,amount) values (1,-1000)`;
      await tx`update ${submissions} set status='APPROVED' where id=1`;
      throw new Error("SIMULATED_REWARD_FAILURE");
    }),/SIMULATED_REWARD_FAILURE/);
    const [row] = await sql`select status from ${submissions} where id=1`;
    const [charges] = await sql`select count(*)::int as total from ${ledger}`;
    assert.equal(row.status,"SUBMITTED");
    assert.equal(charges.total,0);
  } finally {
    try { await sql`drop table if exists ${ledger}`; await sql`drop table if exists ${submissions}`; }
    finally { await sql.end(); }
  }
});

test("posting audit failure rolls back approval, debit and partner reward together", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const submissions = sql("posting_atomic_submission_" + suffix);
  const ledger = sql("posting_atomic_ledger_" + suffix);
  const earnings = sql("posting_atomic_earnings_" + suffix);
  const audits = sql("posting_atomic_audits_" + suffix);
  try {
    await sql`create table ${submissions} (id integer primary key, status text not null)`;
    await sql`create table ${ledger} (submission_id integer unique not null, amount integer not null)`;
    await sql`create table ${earnings} (submission_id integer unique not null, amount integer not null)`;
    await sql`create table ${audits} (submission_id integer not null, action text not null check (action = 'POSTING_APPROVED'))`;
    await sql`insert into ${submissions} (id,status) values (1,'SUBMITTED')`;
    const approve = (auditAction) => sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('posting:atomic:1'))`;
      await tx`insert into ${ledger} (submission_id,amount) values (1,-1000)`;
      await tx`insert into ${earnings} (submission_id,amount) values (1,700)`;
      await tx`update ${submissions} set status='APPROVED' where id=1`;
      await tx`insert into ${audits} (submission_id,action) values (1,${auditAction})`;
    });
    await assert.rejects(approve("INVALID_AUDIT_ACTION"));
    const [afterFailure] = await sql`select status from ${submissions} where id=1`;
    assert.equal(afterFailure.status,"SUBMITTED");
    for (const table of [ledger,earnings,audits]) {
      const [row] = await sql`select count(*)::int as total from ${table}`;
      assert.equal(row.total,0);
    }
    await approve("POSTING_APPROVED");
    const [afterSuccess] = await sql`select status from ${submissions} where id=1`;
    assert.equal(afterSuccess.status,"APPROVED");
    for (const table of [ledger,earnings,audits]) {
      const [row] = await sql`select count(*)::int as total from ${table}`;
      assert.equal(row.total,1);
    }
  } finally {
    try {
      await sql`drop table if exists ${audits}`;
      await sql`drop table if exists ${earnings}`;
      await sql`drop table if exists ${ledger}`;
      await sql`drop table if exists ${submissions}`;
    } finally { await sql.end(); }
  }
});

test("posting notification failure rolls back review, ledger, earning and audit", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const submissions = sql("posting_notice_submission_" + suffix);
  const ledger = sql("posting_notice_ledger_" + suffix);
  const earnings = sql("posting_notice_earnings_" + suffix);
  const audits = sql("posting_notice_audits_" + suffix);
  const notices = sql("posting_notice_notifications_" + suffix);
  try {
    await sql`create table ${submissions} (id integer primary key, status text not null)`;
    await sql`create table ${ledger} (submission_id integer unique not null, amount integer not null)`;
    await sql`create table ${earnings} (submission_id integer unique not null, amount integer not null)`;
    await sql`create table ${audits} (submission_id integer not null, action text not null)`;
    await sql`create table ${notices} (submission_id integer not null, recipient text not null check (recipient in ('PARTNER','ADVERTISER')))`;
    await sql`insert into ${submissions} (id,status) values (1,'SUBMITTED')`;
    const approve = (recipient) => sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('posting:notification:1'))`;
      await tx`insert into ${ledger} (submission_id,amount) values (1,-1000)`;
      await tx`insert into ${earnings} (submission_id,amount) values (1,700)`;
      await tx`update ${submissions} set status='APPROVED' where id=1`;
      await tx`insert into ${audits} (submission_id,action) values (1,'POSTING_APPROVED')`;
      await tx`insert into ${notices} (submission_id,recipient) values (1,'PARTNER')`;
      await tx`insert into ${notices} (submission_id,recipient) values (1,${recipient})`;
    });
    await assert.rejects(approve("INVALID_RECIPIENT"));
    const [afterFailure] = await sql`select status from ${submissions} where id=1`;
    assert.equal(afterFailure.status,"SUBMITTED");
    for (const table of [ledger,earnings,audits,notices]) {
      const [row] = await sql`select count(*)::int as total from ${table}`;
      assert.equal(row.total,0);
    }
    await approve("ADVERTISER");
    const [afterSuccess] = await sql`select status from ${submissions} where id=1`;
    assert.equal(afterSuccess.status,"APPROVED");
    for (const table of [ledger,earnings,audits]) {
      const [row] = await sql`select count(*)::int as total from ${table}`;
      assert.equal(row.total,1);
    }
    const [noticeCount] = await sql`select count(*)::int as total from ${notices}`;
    assert.equal(noticeCount.total,2);
  } finally {
    try {
      await sql`drop table if exists ${notices}`;
      await sql`drop table if exists ${audits}`;
      await sql`drop table if exists ${earnings}`;
      await sql`drop table if exists ${ledger}`;
      await sql`drop table if exists ${submissions}`;
    } finally { await sql.end(); }
  }
});

test("concurrent posting submissions accept one request and do not duplicate admin notices", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 3, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const applications = sql("posting_race_applications_" + suffix);
  const submissions = sql("posting_race_submissions_" + suffix);
  const notices = sql("posting_race_notices_" + suffix);
  try {
    await sql`create table ${applications} (id integer primary key, status text not null)`;
    await sql`create table ${submissions} (application_id integer unique not null, status text not null, revision_count integer not null default 0)`;
    await sql`create table ${notices} (application_id integer not null, message text not null)`;
    await sql`insert into ${applications} (id,status) values (1,'APPLIED')`;
    const submit = async () => {
      try {
        return await sql.begin(async tx => {
          const [application] = await tx`select status from ${applications} where id=1 for update`;
          const [existing] = await tx`select status from ${submissions} where application_id=1 for update`;
          if (existing?.status === "SUBMITTED") return "ALREADY_SUBMITTED";
          if (existing && existing.status !== "REVISION_REQUESTED") return "SUBMISSION_LOCKED";
          if (existing) {
            await tx`update ${submissions} set status='SUBMITTED',revision_count=revision_count+1 where application_id=1`;
          } else {
            assert.equal(application.status,"APPLIED");
            await tx`insert into ${submissions} (application_id,status) values (1,'SUBMITTED')`;
          }
          await tx`update ${applications} set status='SUBMITTED' where id=1`;
          await tx`insert into ${notices} (application_id,message) values (1,'REVIEW_REQUESTED')`;
          return "SUBMITTED";
        });
      } catch (error) { throw error; }
    };
    assert.deepEqual((await Promise.all([submit(),submit()])).sort(),["ALREADY_SUBMITTED","SUBMITTED"]);
    const [submissionCount] = await sql`select count(*)::int as total from ${submissions}`;
    const [noticeCount] = await sql`select count(*)::int as total from ${notices}`;
    assert.equal(submissionCount.total,1);
    assert.equal(noticeCount.total,1);
    await sql`update ${submissions} set status='REVISION_REQUESTED' where application_id=1`;
    await sql`update ${applications} set status='REVISION_REQUESTED' where id=1`;
    assert.deepEqual((await Promise.all([submit(),submit()])).sort(),["ALREADY_SUBMITTED","SUBMITTED"]);
    const [revision] = await sql`select status,revision_count from ${submissions} where application_id=1`;
    const [afterRevisionNotices] = await sql`select count(*)::int as total from ${notices}`;
    assert.equal(revision.status,"SUBMITTED");
    assert.equal(revision.revision_count,1);
    assert.equal(afterRevisionNotices.total,2);
  } finally {
    try {
      await sql`drop table if exists ${notices}`;
      await sql`drop table if exists ${submissions}`;
      await sql`drop table if exists ${applications}`;
    } finally { await sql.end(); }
  }
});

test("posting end-to-end database flow: submit, request revision, resubmit and approve once", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 3, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const applications = sql("posting_flow_applications_" + suffix);
  const submissions = sql("posting_flow_submissions_" + suffix);
  const ledger = sql("posting_flow_ledger_" + suffix);
  const earnings = sql("posting_flow_earnings_" + suffix);
  const notices = sql("posting_flow_notices_" + suffix);
  const reviews = sql("posting_flow_reviews_" + suffix);
  try {
    await sql`create table ${applications} (id integer primary key, status text not null)`;
    await sql`create table ${submissions} (application_id integer unique not null, status text not null, revision_count integer not null default 0)`;
    await sql`create table ${ledger} (application_id integer unique not null, amount integer not null)`;
    await sql`create table ${earnings} (application_id integer unique not null, amount integer not null)`;
    await sql`create table ${notices} (application_id integer not null, recipient text not null)`;
    await sql`create table ${reviews} (application_id integer not null, decision text not null)`;
    await sql`insert into ${applications} (id,status) values (1,'APPLIED')`;
    const submit = () => sql.begin(async tx => {
      await tx`select status from ${applications} where id=1 for update`;
      const [existing] = await tx`select status,revision_count from ${submissions} where application_id=1 for update`;
      if (existing && existing.status !== "REVISION_REQUESTED") return "ALREADY_SUBMITTED";
      if (existing) {
        assert.ok(existing.revision_count < 2);
        await tx`update ${submissions} set status='SUBMITTED',revision_count=revision_count+1 where application_id=1`;
      } else await tx`insert into ${submissions} (application_id,status) values (1,'SUBMITTED')`;
      await tx`update ${applications} set status='SUBMITTED' where id=1`;
      await tx`insert into ${notices} (application_id,recipient) values (1,'ADMIN')`;
      return "SUBMITTED";
    });
    const review = (decision) => sql.begin(async tx => {
      await tx`select status from ${applications} where id=1 for update`;
      const [submission] = await tx`select status from ${submissions} where application_id=1 for update`;
      if (submission.status !== "SUBMITTED") return "ALREADY_PROCESSED";
      if (decision === "APPROVED") {
        await tx`insert into ${ledger} (application_id,amount) values (1,-1000)`;
        await tx`insert into ${earnings} (application_id,amount) values (1,700)`;
      }
      await tx`insert into ${reviews} (application_id,decision) values (1,${decision})`;
      await tx`update ${submissions} set status=${decision} where application_id=1`;
      await tx`update ${applications} set status=${decision} where id=1`;
      await tx`insert into ${notices} (application_id,recipient) values (1,'PARTNER'),(1,'ADVERTISER')`;
      return decision;
    });
    assert.equal(await submit(),"SUBMITTED");
    assert.equal(await review("REVISION_REQUESTED"),"REVISION_REQUESTED");
    assert.equal(await submit(),"SUBMITTED");
    assert.deepEqual((await Promise.all([review("APPROVED"),review("APPROVED")])).sort(),["ALREADY_PROCESSED","APPROVED"]);
    const [submission] = await sql`select status,revision_count from ${submissions} where application_id=1`;
    assert.deepEqual(submission,{status:"APPROVED",revision_count:1});
    const [application] = await sql`select status from ${applications} where id=1`;
    assert.equal(application.status,"APPROVED");
    const [charged] = await sql`select count(*)::int as total,sum(amount)::int as amount from ${ledger}`;
    const [earned] = await sql`select count(*)::int as total,sum(amount)::int as amount from ${earnings}`;
    const [noticeCount] = await sql`select count(*)::int as total from ${notices}`;
    const [reviewCount] = await sql`select count(*)::int as total from ${reviews}`;
    assert.deepEqual(charged,{total:1,amount:-1000});
    assert.deepEqual(earned,{total:1,amount:700});
    assert.equal(noticeCount.total,6);
    assert.equal(reviewCount.total,2);
  } finally {
    try {
      await sql`drop table if exists ${reviews}`;
      await sql`drop table if exists ${notices}`;
      await sql`drop table if exists ${earnings}`;
      await sql`drop table if exists ${ledger}`;
      await sql`drop table if exists ${submissions}`;
      await sql`drop table if exists ${applications}`;
    } finally { await sql.end(); }
  }
});

test("posting rejection keeps balances unchanged and persists one review notification pair", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 3, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const submissions = sql("posting_reject_submissions_" + suffix);
  const reviews = sql("posting_reject_reviews_" + suffix);
  const ledger = sql("posting_reject_ledger_" + suffix);
  const earnings = sql("posting_reject_earnings_" + suffix);
  const notices = sql("posting_reject_notices_" + suffix);
  try {
    await sql`create table ${submissions} (id integer primary key,status text not null)`;
    await sql`create table ${reviews} (submission_id integer not null,decision text not null,reason text)`;
    await sql`create table ${ledger} (submission_id integer not null,amount integer not null)`;
    await sql`create table ${earnings} (submission_id integer not null,amount integer not null)`;
    await sql`create table ${notices} (submission_id integer not null,recipient text not null)`;
    await sql`insert into ${submissions} (id,status) values (1,'SUBMITTED')`;
    const reject = () => sql.begin(async tx => {
      const [current] = await tx`select status from ${submissions} where id=1 for update`;
      if (current.status !== "SUBMITTED") return "ALREADY_PROCESSED";
      await tx`insert into ${reviews} (submission_id,decision,reason) values (1,'REJECTED','조건 미충족')`;
      await tx`update ${submissions} set status='REJECTED' where id=1`;
      await tx`insert into ${notices} (submission_id,recipient) values (1,'PARTNER'),(1,'ADVERTISER')`;
      return "REJECTED";
    });
    assert.deepEqual((await Promise.all([reject(),reject()])).sort(),["ALREADY_PROCESSED","REJECTED"]);
    const [state] = await sql`select status from ${submissions} where id=1`;
    assert.equal(state.status,"REJECTED");
    const [review] = await sql`select count(*)::int as total from ${reviews}`;
    const [notice] = await sql`select count(*)::int as total from ${notices}`;
    assert.equal(review.total,1);
    assert.equal(notice.total,2);
    for (const table of [ledger,earnings]) {
      const [row] = await sql`select count(*)::int as total from ${table}`;
      assert.equal(row.total,0);
    }
  } finally {
    try {
      await sql`drop table if exists ${notices}`;
      await sql`drop table if exists ${earnings}`;
      await sql`drop table if exists ${ledger}`;
      await sql`drop table if exists ${reviews}`;
      await sql`drop table if exists ${submissions}`;
    } finally { await sql.end(); }
  }
});

test("posting revision request rolls back review and status when advertiser notification fails", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 3, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const submissions = sql("posting_revision_submissions_" + suffix);
  const applications = sql("posting_revision_applications_" + suffix);
  const reviews = sql("posting_revision_reviews_" + suffix);
  const ledger = sql("posting_revision_ledger_" + suffix);
  const earnings = sql("posting_revision_earnings_" + suffix);
  const notices = sql("posting_revision_notices_" + suffix);
  try {
    await sql`create table ${submissions} (id integer primary key,status text not null,revision_count integer not null default 0)`;
    await sql`create table ${applications} (id integer primary key,status text not null)`;
    await sql`create table ${reviews} (submission_id integer not null,decision text not null)`;
    await sql`create table ${ledger} (submission_id integer not null,amount integer not null)`;
    await sql`create table ${earnings} (submission_id integer not null,amount integer not null)`;
    await sql`create table ${notices} (submission_id integer not null,recipient text not null check (recipient in ('PARTNER','ADVERTISER')))`;
    await sql`insert into ${submissions} (id,status) values (1,'SUBMITTED')`;
    await sql`insert into ${applications} (id,status) values (1,'SUBMITTED')`;
    const requestRevision = recipient => sql.begin(async tx => {
      const [submission] = await tx`select status,revision_count from ${submissions} where id=1 for update`;
      if (submission.status !== "SUBMITTED") return "ALREADY_PROCESSED";
      assert.ok(submission.revision_count < 2);
      await tx`insert into ${reviews} (submission_id,decision) values (1,'REVISION_REQUESTED')`;
      await tx`update ${submissions} set status='REVISION_REQUESTED' where id=1`;
      await tx`update ${applications} set status='REVISION_REQUESTED' where id=1`;
      await tx`insert into ${notices} (submission_id,recipient) values (1,'PARTNER')`;
      await tx`insert into ${notices} (submission_id,recipient) values (1,${recipient})`;
      return "REVISION_REQUESTED";
    });
    await assert.rejects(requestRevision("INVALID_RECIPIENT"));
    for (const table of [submissions,applications]) {
      const [row] = await sql`select status from ${table} where id=1`;
      assert.equal(row.status,"SUBMITTED");
    }
    for (const table of [reviews,notices,ledger,earnings]) {
      const [row] = await sql`select count(*)::int as total from ${table}`;
      assert.equal(row.total,0);
    }
    assert.equal(await requestRevision("ADVERTISER"),"REVISION_REQUESTED");
    for (const table of [submissions,applications]) {
      const [row] = await sql`select status from ${table} where id=1`;
      assert.equal(row.status,"REVISION_REQUESTED");
    }
    const [reviewCount] = await sql`select count(*)::int as total from ${reviews}`;
    const [noticeCount] = await sql`select count(*)::int as total from ${notices}`;
    assert.equal(reviewCount.total,1);
    assert.equal(noticeCount.total,2);
    for (const table of [ledger,earnings]) {
      const [row] = await sql`select count(*)::int as total from ${table}`;
      assert.equal(row.total,0);
    }
  } finally {
    try {
      await sql`drop table if exists ${notices}`;
      await sql`drop table if exists ${earnings}`;
      await sql`drop table if exists ${ledger}`;
      await sql`drop table if exists ${reviews}`;
      await sql`drop table if exists ${applications}`;
      await sql`drop table if exists ${submissions}`;
    } finally { await sql.end(); }
  }
});


test("posting approval rechecks advertiser balance after concurrent debit and rejects duplicate review", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 5, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const submissions = sql("posting_balance_submissions_" + suffix);
  const accounts = sql("posting_balance_accounts_" + suffix);
  const ledger = sql("posting_balance_ledger_" + suffix);
  const earnings = sql("posting_balance_earnings_" + suffix);
  const reviews = sql("posting_balance_reviews_" + suffix);
  try {
    await sql`create table ${submissions} (id integer primary key,status text not null)`;
    await sql`create table ${accounts} (id integer primary key,balance integer not null)`;
    await sql`create table ${ledger} (submission_id integer not null,amount integer not null)`;
    await sql`create table ${earnings} (submission_id integer not null,amount integer not null)`;
    await sql`create table ${reviews} (submission_id integer not null,decision text not null)`;
    await sql`insert into ${submissions} (id,status) values (1,'SUBMITTED')`;
    await sql`insert into ${accounts} (id,balance) values (1,1000)`;
    const approve = () => sql.begin(async tx => {
      const [account] = await tx`select balance from ${accounts} where id=1 for update`;
      const [submission] = await tx`select status from ${submissions} where id=1 for update`;
      if (submission.status !== "SUBMITTED") return "ALREADY_PROCESSED";
      if (account.balance < 1000) return "ADVERTISER_BALANCE_INSUFFICIENT";
      await tx`update ${accounts} set balance=balance-1000 where id=1`;
      await tx`insert into ${ledger} (submission_id,amount) values (1,-1000)`;
      await tx`insert into ${earnings} (submission_id,amount) values (1,700)`;
      await tx`insert into ${reviews} (submission_id,decision) values (1,'APPROVED')`;
      await tx`update ${submissions} set status='APPROVED' where id=1`;
      return "APPROVED";
    });
    const spend = () => sql.begin(async tx => {
      const [account] = await tx`select balance from ${accounts} where id=1 for update`;
      if (account.balance < 600) return "INSUFFICIENT";
      await tx`update ${accounts} set balance=balance-600 where id=1`;
      return "SPENT";
    });
    assert.equal(await spend(),"SPENT");
    assert.equal(await approve(),"ADVERTISER_BALANCE_INSUFFICIENT");
    const [unchanged] = await sql`select status from ${submissions} where id=1`;
    assert.equal(unchanged.status,"SUBMITTED");
    for (const table of [ledger,earnings,reviews]) {
      const [row] = await sql`select count(*)::int as total from ${table}`;
      assert.equal(row.total,0);
    }
    await sql`update ${accounts} set balance=balance+1000 where id=1`;
    assert.deepEqual((await Promise.all([approve(),approve()])).sort(),["ALREADY_PROCESSED","APPROVED"]);
    const [account] = await sql`select balance from ${accounts} where id=1`;
    assert.equal(account.balance,400);
    const [submission] = await sql`select status from ${submissions} where id=1`;
    assert.equal(submission.status,"APPROVED");
    for (const table of [ledger,earnings,reviews]) {
      const [row] = await sql`select count(*)::int as total from ${table}`;
      assert.equal(row.total,1);
    }
  } finally {
    try {
      for (const table of [reviews,earnings,ledger,accounts,submissions]) await sql`drop table if exists ${table}`;
    } finally { await sql.end(); }
  }
});

test("admin settlement audit anomaly SQL agrees with status validator", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 3, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const settlements = sql("settlement_audit_states_" + suffix);
  const audits = sql("settlement_audit_actions_" + suffix);
  const cases = [
    ["REQUESTED", [], false],
    ["REQUESTED", ["SETTLEMENT_APPROVE"], true],
    ["APPROVED", ["SETTLEMENT_APPROVE"], false],
    ["APPROVED", [], true],
    ["APPROVED", ["SETTLEMENT_APPROVE", "SETTLEMENT_APPROVE"], true],
    ["APPROVED", ["SETTLEMENT_APPROVE", "SETTLEMENT_REJECT"], true],
    ["PAID", ["SETTLEMENT_APPROVE", "SETTLEMENT_PAID"], false],
    ["PAID", ["SETTLEMENT_PAID", "SETTLEMENT_APPROVE"], true],
    ["PAID", ["SETTLEMENT_APPROVE"], true],
    ["PAID", ["SETTLEMENT_APPROVE", "SETTLEMENT_PAID", "SETTLEMENT_PAID"], true],
    ["REJECTED", ["SETTLEMENT_REJECT"], false],
    ["REJECTED", ["SETTLEMENT_REJECT", "SETTLEMENT_REJECT"], true],
    ["REJECTED", ["SETTLEMENT_APPROVE", "SETTLEMENT_REJECT"], true],
  ];
  try {
    await sql`create table ${settlements} (id integer primary key, status text not null)`;
    await sql`create table ${audits} (id serial primary key, settlement_id integer not null, action text not null, created_at timestamptz not null)`;
    for (const [index, [status, actions]] of cases.entries()) {
      const id = index + 1;
      await sql`insert into ${settlements} (id,status) values (${id},${status})`;
      for (const [offset, action] of actions.entries()) {
        await sql`insert into ${audits} (settlement_id,action,created_at) values (${id},${action},${new Date(Date.UTC(2026,0,1,0,0,offset))})`;
      }
    }
    const rows = await sql`select s.id, s.status, coalesce((select array_agg(a.action order by a.created_at,a.id) from ${audits} a where a.settlement_id=s.id and a.action in ('SETTLEMENT_APPROVE','SETTLEMENT_PAID','SETTLEMENT_REJECT')),ARRAY[]::text[]) as actions,
      not (case when s.status='REQUESTED' then coalesce((select array_agg(a.action order by a.created_at,a.id) from ${audits} a where a.settlement_id=s.id and a.action in ('SETTLEMENT_APPROVE','SETTLEMENT_PAID','SETTLEMENT_REJECT')),ARRAY[]::text[])=ARRAY[]::text[]
      when s.status='APPROVED' then coalesce((select array_agg(a.action order by a.created_at,a.id) from ${audits} a where a.settlement_id=s.id and a.action in ('SETTLEMENT_APPROVE','SETTLEMENT_PAID','SETTLEMENT_REJECT')),ARRAY[]::text[])=ARRAY['SETTLEMENT_APPROVE']::text[]
      when s.status='PAID' then coalesce((select array_agg(a.action order by a.created_at,a.id) from ${audits} a where a.settlement_id=s.id and a.action in ('SETTLEMENT_APPROVE','SETTLEMENT_PAID','SETTLEMENT_REJECT')),ARRAY[]::text[])=ARRAY['SETTLEMENT_APPROVE','SETTLEMENT_PAID']::text[]
      when s.status='REJECTED' then coalesce((select array_agg(a.action order by a.created_at,a.id) from ${audits} a where a.settlement_id=s.id and a.action in ('SETTLEMENT_APPROVE','SETTLEMENT_PAID','SETTLEMENT_REJECT')),ARRAY[]::text[])=ARRAY['SETTLEMENT_REJECT']::text[] else false end) as anomaly from ${settlements} s order by s.id`;
    const breakdown = await sql`select status, count(*)::integer as anomalies from (
      select s.status, coalesce((select array_agg(a.action order by a.created_at,a.id) from ${audits} a
        where a.settlement_id=s.id and a.action in ('SETTLEMENT_APPROVE','SETTLEMENT_PAID','SETTLEMENT_REJECT')),ARRAY[]::text[]) as actions
      from ${settlements} s
    ) t where not (case
      when status='REQUESTED' then actions=ARRAY[]::text[]
      when status='APPROVED' then actions=ARRAY['SETTLEMENT_APPROVE']::text[]
      when status='PAID' then actions=ARRAY['SETTLEMENT_APPROVE','SETTLEMENT_PAID']::text[]
      when status='REJECTED' then actions=ARRAY['SETTLEMENT_REJECT']::text[]
      else false end)
    group by status`;
    const expectedCounts = new Map();
    for (const [status,, anomaly] of cases) if (anomaly) expectedCounts.set(status,(expectedCounts.get(status)??0)+1);
    const actualCounts = new Map(breakdown.map(row=>[row.status,row.anomalies]));
    assert.deepEqual([...actualCounts].sort(),[...expectedCounts].sort(),"per-status anomaly counts");
    assert.equal([...actualCounts.values()].reduce((sum,n)=>sum+n,0),rows.filter(row=>row.anomaly).length,"breakdown sums to total anomalies");
    assert.equal(rows.length, cases.length);
    for (const [index, row] of rows.entries()) {
      const [status, actions, expectedAnomaly] = cases[index];
      assert.equal(row.status, status);
      assert.deepEqual([...row.actions], actions);
      assert.equal(row.anomaly, expectedAnomaly, "case " + index + " status=" + status);
    }
  } finally {
    try { await sql`drop table if exists ${audits}`; await sql`drop table if exists ${settlements}`; }
    finally { await sql.end(); }
  }
});


test("failed payout audit rolls back settlement status and earning release", {skip: !url || !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const suffix = process.pid + "_" + Math.random().toString(36).slice(2, 10);
  const settlement = sql("payout_rollback_settlement_" + suffix);
  const earning = sql("payout_rollback_earning_" + suffix);
  const audit = sql("payout_rollback_audit_" + suffix);
  try {
    await sql`create table ${settlement} (id integer primary key,status text not null)`;
    await sql`create table ${earning} (id integer primary key,status text not null)`;
    await sql`create table ${audit} (id integer primary key,action text not null)`;
    await sql`insert into ${settlement} (id,status) values (1,'APPROVED')`;
    await sql`insert into ${earning} (id,status) values (1,'HOLD')`;
    await assert.rejects(sql.begin(async tx => {
      await tx`select id from ${settlement} where id=1 for update`;
      await tx`update ${settlement} set status='PAID' where id=1`;
      await tx`update ${earning} set status='PAID' where id=1`;
      await tx`insert into ${audit} (id,action) values (1,'SETTLEMENT_PAID')`;
      throw new Error("simulated audit persistence failure");
    }), /simulated audit persistence failure/);
    const [s] = await sql`select status from ${settlement} where id=1`;
    const [e] = await sql`select status from ${earning} where id=1`;
    const [a] = await sql`select count(*)::int as count from ${audit}`;
    assert.equal(s.status,"APPROVED");
    assert.equal(e.status,"HOLD");
    assert.equal(a.count,0);
  } finally {
    try { for (const table of [audit,earning,settlement]) await sql`drop table if exists ${table}`; }
    finally { await sql.end(); }
  }
});
