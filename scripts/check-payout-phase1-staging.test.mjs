import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const baseline = {
  PAYOUT_STAGING_DATABASE_URL: 'postgresql://synthetic:synthetic-only@isolated-test.example.invalid:5432/payout_test?sslmode=require',
  PAYOUT_STAGING_BASE_URL: 'https://mypickup-payout-test-synthetic.vercel.app/',
  PAYOUT_STAGING_TEST_PARTNER_ID: 'synthetic-partner',
  PAYOUT_STAGING_TEST_ADMIN_ID: 'synthetic-admin',
  PAYOUT_STAGING_SYNTHETIC_DATA_CONFIRMED: 'yes',
  PAYOUT_STAGING_NOTIFICATIONS_DISABLED: 'yes',
  PAYOUT_STAGING_ISOLATED_DB_CONFIRMED: 'yes',
  DATABASE_URL: 'postgresql://production:production-only@production.example.invalid:5432/production?sslmode=require',
  NODE_ENV: 'test',
  VERCEL_ENV: 'development',
  PAYOUT_KYC_ENFORCEMENT: 'disabled',
  PAYOUT_KYC_DOCUMENT_UPLOAD: 'disabled',
};
function check(changes = {}) {
  const result = spawnSync(process.execPath, ['scripts/check-payout-phase1-staging.mjs'], {
    env: { ...process.env, ...baseline, ...changes }, encoding: 'utf8', timeout: 5000,
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}
test('staging preflight accepts only explicitly attested synthetic configuration', () => {
  const result = check();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Manual verification/);
});
for (const [name, changes] of [
  ['same database URL', { PAYOUT_STAGING_DATABASE_URL: baseline.DATABASE_URL }],
  ['shared database host', { PAYOUT_STAGING_DATABASE_URL: 'postgresql://synthetic:synthetic@production.example.invalid:5432/payout_test?sslmode=require' }],
  ['shared host on another port', { PAYOUT_STAGING_DATABASE_URL: 'postgresql://synthetic:synthetic@production.example.invalid:6543/payout_test?sslmode=require' }],
  ['production environment', { VERCEL_ENV: 'production' }],
  ['production Node environment', { NODE_ENV: 'production' }],
  ['unconfirmed isolation', { PAYOUT_STAGING_ISOLATED_DB_CONFIRMED: 'no' }],
  ['notifications enabled', { PAYOUT_STAGING_NOTIFICATIONS_DISABLED: 'no' }],
  ['non-synthetic data', { PAYOUT_STAGING_SYNTHETIC_DATA_CONFIRMED: 'no' }],
  ['KYC enabled', { PAYOUT_KYC_DOCUMENT_UPLOAD: 'enabled' }],
  ['production domain', { PAYOUT_STAGING_BASE_URL: 'https://mypickup.kr/' }],
  ['insecure database', { PAYOUT_STAGING_DATABASE_URL: 'postgresql://synthetic:synthetic@isolated-test.example.invalid:5432/payout_test?sslmode=disable' }],
  ['localhost database', { PAYOUT_STAGING_DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:5432/payout_test' }],
  ['missing TLS mode', { PAYOUT_STAGING_DATABASE_URL: 'postgresql://synthetic:synthetic@isolated-test.example.invalid:5432/payout_test' }],
  ['weak TLS mode', { PAYOUT_STAGING_DATABASE_URL: 'postgresql://synthetic:synthetic@isolated-test.example.invalid:5432/payout_test?sslmode=prefer' }],
  ['missing database name', { PAYOUT_STAGING_DATABASE_URL: 'postgresql://synthetic:synthetic@isolated-test.example.invalid:5432/?sslmode=require' }],
  ['database URL fragment', { PAYOUT_STAGING_DATABASE_URL: 'postgresql://synthetic:synthetic@isolated-test.example.invalid:5432/payout_test?sslmode=require#secret' }],
  ['missing administrator', { PAYOUT_STAGING_TEST_ADMIN_ID: '' }],
]) {
  test(`staging preflight blocks ${name}`, () => {
    const result = check(changes);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /BLOCKED:/);
  });
}
