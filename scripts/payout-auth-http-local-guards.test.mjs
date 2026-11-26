import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const scripts = ['scripts/seed-payout-auth-http-local.mjs', 'scripts/test-payout-auth-http-local.mjs'];
const safe = {
  NODE_ENV: 'test',
  VERCEL_ENV: 'development',
  PAYOUT_LOCAL_AUTH_TEST_CONFIRM: 'disposable-only',
  PAYOUT_LOCAL_SYNTHETIC_PASSWORD: 'synthetic-password-only-12345',
  SETTLEMENT_TEST_DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:55441/payout_auth_test',
};
const cases = [
  ['missing explicit confirmation', { PAYOUT_LOCAL_AUTH_TEST_CONFIRM: '' }],
  ['production environment', { NODE_ENV: 'production' }],
  ['production deployment', { VERCEL_ENV: 'production' }],
  ['remote database host', { SETTLEMENT_TEST_DATABASE_URL: 'postgresql://synthetic:synthetic@remote.example.invalid:55441/payout_auth_test' }],
  ['unexpected port', { SETTLEMENT_TEST_DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:5432/payout_auth_test' }],
  ['unexpected database', { SETTLEMENT_TEST_DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:55441/production' }],
  ['missing synthetic password', { PAYOUT_LOCAL_SYNTHETIC_PASSWORD: '' }],
];
for (const script of scripts) {
  for (const [label, changes] of cases) {
    test(`${script} rejects ${label} before connecting`, () => {
      const result = spawnSync(process.execPath, [script], {
        cwd: process.cwd(),
        env: { ...process.env, ...safe, ...changes },
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /AssertionError/);
      assert.doesNotMatch(result.stderr, /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/);
    });
  }
}
