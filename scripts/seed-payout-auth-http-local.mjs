import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import postgres from 'postgres';
const url = new URL(process.env.SETTLEMENT_TEST_DATABASE_URL ?? '');
assert.equal(process.env.PAYOUT_LOCAL_AUTH_TEST_CONFIRM, 'disposable-only');
assert.equal(process.env.NODE_ENV, 'test');
assert.notEqual(process.env.VERCEL_ENV, 'production');
assert.equal(url.protocol, 'postgresql:');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.port, '55441');
assert.equal(url.pathname, '/payout_minimal_harden_auth_test_20261126');
const password = process.env.PAYOUT_LOCAL_SYNTHETIC_PASSWORD;
assert.ok(password?.length >= 16);
const sql = postgres(url.toString(), { max: 1 });
try {
  const [identity] = await sql`select current_database() as name, current_setting('server_version_num')::int as version`;
  assert.equal(identity.name, 'payout_minimal_harden_auth_test_20261126');
  assert.ok(identity.version >= 160000, 'PostgreSQL 16+ required');
  const existing = await sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`;
  assert.equal(existing.length, 0, 'Seeding is permitted only on a completely empty disposable database');
  for (const file of ['0000_initial.sql', '0001_advertiser_users.sql', '0002_notifications.sql', '0003_posting_finance.sql', '0005_audit_logs.sql', '0006_login_attempts.sql', '0011_settlement_item_uniqueness.sql']) {
    await sql.unsafe(await readFile(`db/migrations/${file}`, 'utf8'));
  }
  const salt = randomBytes(16).toString('hex');
  const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
  for (const [email, role] of [['local-partner@synthetic.invalid', 'PARTNER'], ['local-admin@synthetic.invalid', 'ADMIN']]) {
    await sql`insert into users(email,password_hash,role,status) values (${email},${hash},${role}::user_role,'ACTIVE'::user_status)`;
  }
  const [user] = await sql`select id from users where email='local-partner@synthetic.invalid'`;
  const [partner] = await sql`insert into partners(user_id,partner_code,name) values (${user.id},'LOCAL-AUTH-PARTNER','Synthetic local partner') returning id`;
  await sql`insert into earnings(partner_id,type,amount,status) values (${partner.id},'CPA',20000,'AVAILABLE')`;
  console.log('PASS disposable synthetic payout authentication fixtures');
} finally { await sql.end(); }
