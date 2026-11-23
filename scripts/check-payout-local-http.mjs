import assert from 'node:assert/strict';

// Safe, unauthenticated smoke test for a locally running Next.js server.
// Never sends credentials, real cookies, or payout requests with valid input.
const base = new URL(process.env.PAYOUT_LOCAL_HTTP_URL ?? 'http://127.0.0.1:3219/');
assert.equal(base.hostname, '127.0.0.1');
assert.equal(base.protocol, 'http:');
assert.equal(base.pathname, '/');
assert.equal(base.username, '');
assert.equal(base.password, '');
assert.equal(base.search, '');
assert.equal(base.hash, '');
assert.ok(base.port, 'An explicit local test port is required');
assert.notEqual(base.port, '80');
assert.notEqual(base.port, '443');
const checks = [
  { label: 'login missing origin', path: '/api/auth/login', method: 'POST', status: 403, error: 'INVALID_ORIGIN' },
  { label: 'login foreign origin', path: '/api/auth/login', method: 'POST', origin: 'https://foreign.invalid', status: 403, error: 'INVALID_ORIGIN' },
  { label: 'payout missing origin', path: '/api/partner/settlements', method: 'POST', status: 403, error: 'INVALID_ORIGIN' },
  { label: 'payout foreign origin', path: '/api/partner/settlements', method: 'POST', origin: 'https://foreign.invalid', status: 403, error: 'INVALID_ORIGIN' },
  { label: 'partner malformed session', path: '/api/partner/settlements', cookie: 'olbarun_session=invalid', status: 401, error: 'UNAUTHORIZED' },
  { label: 'admin malformed session', path: '/api/admin/settlements/00000000-0000-4000-8000-000000000000/status', cookie: 'olbarun_session=invalid', status: 401, error: 'UNAUTHORIZED' },
];
for (const check of checks) {
  const headers = { accept: 'application/json' };
  if (check.origin) headers.origin = check.origin;
  if (check.cookie) headers.cookie = check.cookie;
  const response = await fetch(new URL(check.path, base), {
    method: check.method ?? 'GET', headers,
    body: check.method === 'POST' ? '{}' : undefined,
    redirect: 'manual', signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, check.status, check.label);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/, check.label);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/, check.label);
  assert.equal(response.headers.get('set-cookie'), null, check.label);
  assert.deepEqual(await response.json(), { ok: false, error: check.error }, check.label);
  console.log(`PASS ${check.label}`);
}
console.log(`PASS ${checks.length} local unauthenticated payout HTTP guards; no database writes`);
