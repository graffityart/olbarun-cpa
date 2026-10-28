import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.SETTLEMENT_TEST_DATABASE_URL;
const testDatabase = (() => { try { return url ? new URL(url) : null; } catch { return null; } })();
const dbName = testDatabase?.pathname.slice(1).toLowerCase() ?? "";
const enabled = process.env.SETTLEMENT_TEST_DB_CONFIRM === "disposable" &&
  process.env.NODE_ENV === "test" && testDatabase !== null &&
  ["postgres:", "postgresql:"].includes(testDatabase.protocol) &&
  /(?:test|disposable|ci)/.test(dbName) &&
  ["localhost", "127.0.0.1", "::1"].includes(testDatabase.hostname) &&
  url !== process.env.DATABASE_URL;

test("CI requires CPA concurrency tests to use a disposable local database", () => {
  if (process.env.CI === "true") {
    assert.ok(url, "SETTLEMENT_TEST_DATABASE_URL is required in CI");
    assert.equal(enabled, true, "CPA concurrency tests must not be skipped in CI");
  }
});

test("CPA approval rollback restores review state and accounting", {skip: !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const table = "cpa_rollback_" + process.pid;
  const ident = sql(table);
  try {
    await sql`create table ${ident} (id integer primary key, status text not null, debit integer not null default 0)`;
    await sql`insert into ${ident} (id,status) values (1,'REVIEWING')`;
    await assert.rejects(sql.begin(async tx => {
      await tx`update ${ident} set status='APPROVED',debit=30000 where id=1`;
      throw new Error("simulated partner earning failure");
    }), /simulated partner earning failure/);
    const [row] = await sql`select status,debit from ${ident} where id=1`;
    assert.equal(row.status,"REVIEWING");
    assert.equal(row.debit,0);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("concurrent CPA reviews commit accounting once", {skip: !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const table = "cpa_review_race_" + process.pid;
  const ident = sql(table);
  try {
    await sql`create table ${ident} (id integer primary key, status text not null, debit integer not null default 0, credit integer not null default 0)`;
    await sql`insert into ${ident} (id,status) values (1,'REVIEWING')`;
    const review = () => sql.begin(async tx => {
      await tx`select id from ${ident} where id = 1 for update`;
      const [row] = await tx`select status from ${ident} where id = 1`;
      if (row.status !== "REVIEWING") return false;
      await tx`update ${ident} set status = 'APPROVED', debit = debit + 30000, credit = credit + 20000 where id = 1`;
      return true;
    });
    assert.deepEqual((await Promise.all([review(), review()])).sort(), [false, true]);
    const [row] = await sql`select status,debit,credit from ${ident} where id = 1`;
    assert.equal(row.status, "APPROVED");
    assert.equal(row.debit, 30000);
    assert.equal(row.credit, 20000);
  } finally {
    try { await sql`drop table if exists ${ident}`; } finally { await sql.end(); }
  }
});

test("CPA accounting rollback removes debit, earning and status change together", {skip: !enabled}, async () => {
  const sql = postgres(url, {max: 2, prepare: false});
  const suffix = process.pid + "_" + Date.now();
  const conversions = sql("cpa_atomic_conversion_" + suffix);
  const ledger = sql("cpa_atomic_ledger_" + suffix);
  const earnings = sql("cpa_atomic_earnings_" + suffix);
  try {
    await sql`create table ${conversions} (id integer primary key, status text not null)`;
    await sql`create table ${ledger} (id integer primary key, conversion_id integer not null, amount integer not null)`;
    await sql`create table ${earnings} (id integer primary key, conversion_id integer not null, amount integer not null)`;
    await sql`insert into ${conversions} (id,status) values (1,'REVIEWING')`;
    await assert.rejects(sql.begin(async tx => {
      await tx`insert into ${ledger} (id,conversion_id,amount) values (1,1,-30000)`;
      await tx`insert into ${earnings} (id,conversion_id,amount) values (1,1,20000)`;
      await tx`update ${conversions} set status='APPROVED' where id=1`;
      throw new Error("simulated audit log insertion failure");
    }), /simulated audit log insertion failure/);
    const [conversion] = await sql`select status from ${conversions} where id=1`;
    const [debitCount] = await sql`select count(*)::int as count from ${ledger}`;
    const [earningCount] = await sql`select count(*)::int as count from ${earnings}`;
    assert.equal(conversion.status, "REVIEWING");
    assert.equal(debitCount.count, 0);
    assert.equal(earningCount.count, 0);
  } finally {
    try {
      await sql`drop table if exists ${earnings}`;
      await sql`drop table if exists ${ledger}`;
      await sql`drop table if exists ${conversions}`;
    } finally { await sql.end(); }
  }
});

test("repeated CPA approval never duplicates advertiser debit or partner earning", {skip: !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const suffix = process.pid + "_" + Date.now();
  const conversion = sql("cpa_repeat_conversion_" + suffix);
  const ledger = sql("cpa_repeat_ledger_" + suffix);
  const earning = sql("cpa_repeat_earning_" + suffix);
  try {
    await sql`create table ${conversion} (id integer primary key, status text not null)`;
    await sql`create table ${ledger} (conversion_id integer primary key, amount integer not null)`;
    await sql`create table ${earning} (conversion_id integer primary key, amount integer not null)`;
    await sql`insert into ${conversion} (id,status) values (1,'REVIEWING')`;
    const approve = () => sql.begin(async tx => {
      await tx`select id from ${conversion} where id=1 for update`;
      const [row] = await tx`select status from ${conversion} where id=1`;
      if (row.status !== "REVIEWING") return false;
      await tx`insert into ${ledger} (conversion_id,amount) values (1,-30000)`;
      await tx`insert into ${earning} (conversion_id,amount) values (1,20000)`;
      await tx`update ${conversion} set status='APPROVED' where id=1`;
      return true;
    });
    assert.deepEqual((await Promise.all([approve(),approve(),approve()])).sort(), [false,false,true]);
    assert.equal(await approve(),false);
    const [debits] = await sql`select count(*)::int as count,sum(amount)::int as total from ${ledger}`;
    const [credits] = await sql`select count(*)::int as count,sum(amount)::int as total from ${earning}`;
    assert.deepEqual([debits.count,debits.total],[1,-30000]);
    assert.deepEqual([credits.count,credits.total],[1,20000]);
  } finally {
    try {
      await sql`drop table if exists ${earning}`;
      await sql`drop table if exists ${ledger}`;
      await sql`drop table if exists ${conversion}`;
    } finally { await sql.end(); }
  }
});

test("simultaneous CPA approve and reject yield one final decision", {skip: !enabled}, async () => {
  const sql = postgres(url, {max: 4, prepare: false});
  const suffix = process.pid + "_" + Date.now();
  const conversion = sql("cpa_race_conversion_" + suffix);
  const ledger = sql("cpa_race_ledger_" + suffix);
  const earning = sql("cpa_race_earning_" + suffix);
  try {
    await sql`create table ${conversion} (id integer primary key, status text not null)`;
    await sql`create table ${ledger} (conversion_id integer primary key, amount integer not null)`;
    await sql`create table ${earning} (conversion_id integer primary key, amount integer not null)`;
    await sql`insert into ${conversion} (id,status) values (1,'REVIEWING')`;
    const decide = (decision) => sql.begin(async tx => {
      await tx`select id from ${conversion} where id=1 for update`;
      const [row] = await tx`select status from ${conversion} where id=1`;
      if (row.status !== "REVIEWING") return false;
      if (decision === "APPROVED") {
        await tx`insert into ${ledger} (conversion_id,amount) values (1,-30000)`;
        await tx`insert into ${earning} (conversion_id,amount) values (1,20000)`;
      }
      await tx`update ${conversion} set status=${decision} where id=1`;
      return true;
    });
    const results = await Promise.all([decide("APPROVED"),decide("REJECTED")]);
    assert.equal(results.filter(Boolean).length,1);
    const [row] = await sql`select status from ${conversion} where id=1`;
    const [debits] = await sql`select count(*)::int as count from ${ledger}`;
    const [credits] = await sql`select count(*)::int as count from ${earning}`;
    assert.ok(["APPROVED","REJECTED"].includes(row.status));
    assert.equal(debits.count,row.status==="APPROVED"?1:0);
    assert.equal(credits.count,row.status==="APPROVED"?1:0);
    assert.equal(await decide("APPROVED"),false);
    assert.equal(await decide("REJECTED"),false);
  } finally {
    try {
      await sql`drop table if exists ${earning}`;
      await sql`drop table if exists ${ledger}`;
      await sql`drop table if exists ${conversion}`;
    } finally { await sql.end(); }
  }
});
