import assert from 'node:assert/strict';
import postgres from 'postgres';
const dbUrl = new URL(process.env.SETTLEMENT_TEST_DATABASE_URL ?? '');
assert.equal(process.env.PAYOUT_LOCAL_AUTH_TEST_CONFIRM, 'disposable-only');
assert.equal(process.env.NODE_ENV, 'test');
assert.notEqual(process.env.VERCEL_ENV, 'production');
assert.equal(dbUrl.protocol, 'postgresql:');
assert.equal(dbUrl.hostname, '127.0.0.1');
assert.equal(dbUrl.port, '55441');
assert.equal(dbUrl.pathname, '/payout_auth_test');
const base = 'http://127.0.0.1:3219';
const sql = postgres(dbUrl.toString(), { max: 1 });
const password = process.env.PAYOUT_LOCAL_SYNTHETIC_PASSWORD;
assert.ok(password?.length >= 16);
async function login(email) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `Login failed: ${email} ${await response.text()}`);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('olbarun_session='));
  return cookie;
}
async function post(path, cookie, payload) {
  const response = await fetch(base + path, { method: 'POST', headers: { origin: base, cookie, 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  return { status: response.status, data };
}
try {
  const partner = await login('local-partner@synthetic.invalid');
  const admin = await login('local-admin@synthetic.invalid');
  const request = await post('/api/partner/settlements', partner, { amount: 20000, bankName: 'Synthetic Bank', accountNumber: '1234567890', accountHolder: 'Synthetic Partner' });
  assert.equal(request.status, 201, JSON.stringify(request));
  const [settlement] = await sql`select id, status from settlements where settlement_code=${request.data.settlementCode}`;
  assert.equal(settlement.status, 'REQUESTED');
  const path = `/api/admin/settlements/${settlement.id}/review`;
  assert.equal((await post(path, admin, { action: 'PAID' })).status, 400);
  assert.equal((await post(path, admin, { action: 'APPROVE' })).status, 200);
  assert.equal((await post(path, admin, { action: 'APPROVE' })).status, 409);
  assert.equal((await post(path, admin, { action: 'PAID', transferConfirmed: true })).status, 200);
  assert.equal((await post(path, admin, { action: 'PAID', transferConfirmed: true })).status, 409);
  const [state] = await sql`select s.status as settlement_status,e.status as earning_status from settlements s join settlement_items i on i.settlement_id=s.id join earnings e on e.id=i.earning_id where s.id=${settlement.id}`;
  assert.equal(state.settlement_status, 'PAID');
  assert.equal(state.earning_status, 'PAID');
  console.log('PASS synthetic authenticated payout HTTP lifecycle');
} finally { await sql.end(); }
