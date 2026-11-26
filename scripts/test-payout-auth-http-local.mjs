import assert from 'node:assert/strict';
import postgres from 'postgres';
const dbUrl = new URL(process.env.SETTLEMENT_TEST_DATABASE_URL ?? '');
assert.equal(process.env.PAYOUT_LOCAL_AUTH_TEST_CONFIRM, 'disposable-only');
assert.equal(process.env.NODE_ENV, 'test');
assert.notEqual(process.env.VERCEL_ENV, 'production');
assert.equal(dbUrl.protocol, 'postgresql:');
assert.equal(dbUrl.hostname, '127.0.0.1');
assert.equal(dbUrl.port, '55441');
assert.equal(dbUrl.pathname, '/payout_minimal_auth_test_20261126');
const base = 'http://127.0.0.1:3219';
const sql = postgres(dbUrl.toString(), { max: 1 });
const password = process.env.PAYOUT_LOCAL_SYNTHETIC_PASSWORD;
assert.ok(password?.length >= 16);
async function login(email) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `Login failed: ${email} ${await response.text()}`);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/i);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('olbarun_session='));
  return cookie;
}
async function post(path, cookie, payload) {
  const response = await fetch(base + path, { method: 'POST', headers: { origin: base, cookie, 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
  assert.match(response.headers.get('cache-control') ?? '', /no-store/i);
  assert.equal(response.headers.get('set-cookie'), null, 'Payout API must not issue session cookies');
  const data = await response.json();
  return { status: response.status, data };
}
try {
  const partner = await login('local-partner@synthetic.invalid');
  const admin = await login('local-admin@synthetic.invalid');
  const payload = { amount: 20000, bankName: 'Synthetic Bank', accountNumber: '1234567890', accountHolder: 'Synthetic Partner' };
  const forbidden = await post('/api/partner/settlements', admin, payload);
  assert.equal(forbidden.status, 403, JSON.stringify(forbidden));
  for (const invalid of [
    { ...payload, accountNumber: '123abc456' },
    { ...payload, accountHolder: '' },
    { ...payload, amount: 10000 },
  ]) {
    const rejected = await post('/api/partner/settlements', partner, invalid);
    assert.equal(rejected.status, invalid.amount === 10000 ? 409 : 400, JSON.stringify(rejected));
  }
  const [before] = await sql`select count(*)::int as n from settlements`;
  assert.equal(before.n, 0, 'Invalid requests must not create settlements');
  const [availableBefore] = await sql`select count(*)::int as n from earnings where status='AVAILABLE'`;
  assert.equal(availableBefore.n, 1, 'Invalid requests must not reserve earnings');
  // Disposable fixture only: fail settlement item persistence after reservation starts.
  // The transaction must roll back the settlement, earning HOLD, and audit entry.
  const [auditBeforeFailure] = await sql`select count(*)::int as n from audit_logs where target_type='SETTLEMENT'`;
  await sql.unsafe(`create function local_fail_settlement_item_insert() returns trigger language plpgsql as $$ begin raise exception 'synthetic payout rollback'; end; $$`);
  try {
    await sql.unsafe(`create trigger local_fail_settlement_item_insert before insert on settlement_items for each row execute function local_fail_settlement_item_insert()`);
    const failed = await post('/api/partner/settlements', partner, payload);
    assert.equal(failed.status, 500, JSON.stringify(failed));
    assert.equal(failed.data.error, 'CREATE_FAILED');
    const [rollbackSettlements] = await sql`select count(*)::int as n from settlements`;
    const [rollbackItems] = await sql`select count(*)::int as n from settlement_items`;
    const [rollbackEarnings] = await sql`select count(*)::int as n from earnings where status='AVAILABLE'`;
    const [rollbackAudits] = await sql`select count(*)::int as n from audit_logs where target_type='SETTLEMENT'`;
    assert.equal(rollbackSettlements.n, 0, 'Failed request must roll back settlement');
    assert.equal(rollbackItems.n, 0, 'Failed request must roll back settlement items');
    assert.equal(rollbackEarnings.n, 1, 'Failed request must restore AVAILABLE earnings');
    assert.equal(rollbackAudits.n, auditBeforeFailure.n, 'Failed request must roll back settlement audit');
  } finally {
    await sql.unsafe('drop trigger if exists local_fail_settlement_item_insert on settlement_items');
    await sql.unsafe('drop function if exists local_fail_settlement_item_insert()');
  }
  const concurrent = await Promise.all([post('/api/partner/settlements', partner, payload), post('/api/partner/settlements', partner, payload)]);
  assert.deepEqual(concurrent.map(item => item.status).sort((a, b) => a - b), [201, 409], JSON.stringify(concurrent));
  const request = concurrent.find(item => item.status === 201);
  assert.ok(request?.data?.settlementCode);
  assert.equal((await post('/api/partner/settlements', partner, payload)).status, 409);
  const [afterConcurrent] = await sql`select count(*)::int as n from settlements`;
  assert.equal(afterConcurrent.n, 1, 'Concurrent requests must create exactly one settlement');
  const [settlement] = await sql`select id, status from settlements where settlement_code=${request.data.settlementCode}`;
  assert.equal(settlement.status, 'REQUESTED');
  const path = `/api/admin/settlements/${settlement.id}/review`;
  assert.equal((await post(path, partner, { action: 'APPROVE' })).status, 403);
  assert.equal((await post(path, admin, { action: 'PAID' })).status, 400);
  assert.equal((await post(path, admin, { action: 'APPROVE' })).status, 200);
  assert.equal((await post(path, admin, { action: 'APPROVE' })).status, 409);
  assert.equal((await post(path, admin, { action: 'PAID', transferConfirmed: true })).status, 200);
  assert.equal((await post(path, admin, { action: 'PAID', transferConfirmed: true })).status, 409);
  const [state] = await sql`select s.status as settlement_status,e.status as earning_status from settlements s join settlement_items i on i.settlement_id=s.id join earnings e on e.id=i.earning_id where s.id=${settlement.id}`;
  assert.equal(state.settlement_status, 'PAID');
  assert.equal(state.earning_status, 'PAID');
  const audits = await sql`select action from audit_logs where target_type='SETTLEMENT' and target_id=${settlement.id} order by created_at, id`;
  assert.deepEqual(audits.map(row => row.action), ['SETTLEMENT_REQUEST', 'SETTLEMENT_APPROVE', 'SETTLEMENT_PAID']);
  const [count] = await sql`select count(*)::int as total from settlement_items where settlement_id=${settlement.id}`;
  assert.equal(count.total, 1);
  // A second synthetic earning verifies the independent REJECT lifecycle.
  const [syntheticPartner] = await sql`select id from partners where partner_code='LOCAL-AUTH-PARTNER'`;
  assert.ok(syntheticPartner?.id, 'Synthetic fixture partner must exist');
  await sql`insert into earnings(partner_id,type,amount,status) values (${syntheticPartner.id},'CPA',15000,'AVAILABLE')`;
  const rejectPayload = { ...payload, amount: 15000 };
  const rejectRequest = await post('/api/partner/settlements', partner, rejectPayload);
  assert.equal(rejectRequest.status, 201, JSON.stringify(rejectRequest));
  const [rejectedSettlement] = await sql`select id,status from settlements where settlement_code=${rejectRequest.data.settlementCode}`;
  assert.equal(rejectedSettlement.status, 'REQUESTED');
  const rejectPath = `/api/admin/settlements/${rejectedSettlement.id}/review`;
  assert.equal((await post(rejectPath, admin, { action: 'REJECT' })).status, 200);
  assert.equal((await post(rejectPath, admin, { action: 'REJECT' })).status, 409);
  assert.equal((await post(rejectPath, admin, { action: 'APPROVE' })).status, 409);
  const [rejectedState] = await sql`select s.status as settlement_status,e.status as earning_status from settlements s join settlement_items i on i.settlement_id=s.id join earnings e on e.id=i.earning_id where s.id=${rejectedSettlement.id}`;
  assert.equal(rejectedState.settlement_status, 'REJECTED');
  assert.equal(rejectedState.earning_status, 'AVAILABLE');
  const rejectedAudits = await sql`select action from audit_logs where target_type='SETTLEMENT' and target_id=${rejectedSettlement.id} order by created_at,id`;
  assert.deepEqual(rejectedAudits.map(row => row.action), ['SETTLEMENT_REQUEST', 'SETTLEMENT_REJECT']);
  async function verify(id, status) {
    const r = await fetch(base + '/api/admin/settlements/' + id + '/status', {headers:{cookie:admin},signal:AbortSignal.timeout(20000)});
    const data = await r.json();
    assert.equal(r.status,200,JSON.stringify(data));
    assert.equal(data.status,status);
    assert.equal(data.auditVerified,true);
    assert.equal(data.amountVerified,true);
  }
  await verify(rejectedSettlement.id,'REJECTED');
  const retry = await post('/api/partner/settlements',partner,rejectPayload);
  assert.equal(retry.status,201,JSON.stringify(retry));
  const [next] = await sql`select id from settlements where settlement_code=${retry.data.settlementCode}`;
  await verify(rejectedSettlement.id,'REJECTED');
  await verify(next.id,'REQUESTED');
  const nextPath = '/api/admin/settlements/' + next.id + '/review';
  assert.equal((await post(nextPath,admin,{action:'APPROVE'})).status,200);
  await verify(rejectedSettlement.id,'REJECTED');
  await verify(next.id,'APPROVED');
  assert.equal((await post(nextPath,admin,{action:'PAID',transferConfirmed:true})).status,200);
  await verify(rejectedSettlement.id,'REJECTED');
  await verify(next.id,'PAID');
  console.log('PASS rejected settlement re-request and historical integrity');

  console.log('PASS synthetic authenticated payout HTTP paid and rejected lifecycles');
} finally { await sql.end(); }
