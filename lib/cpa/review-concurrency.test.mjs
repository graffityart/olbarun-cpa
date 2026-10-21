import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.SETTLEMENT_TEST_DATABASE_URL;
const enabled = Boolean(url) && process.env.SETTLEMENT_TEST_DB_CONFIRM === "disposable" &&
  process.env.NODE_ENV !== "production" && url !== process.env.DATABASE_URL;

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
