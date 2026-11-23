import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const safe = 'https://mypickup-payout-test-synthetic.vercel.app/';
function check(url, overrides = {}) {
  return spawnSync(process.execPath, ['scripts/check-payout-preview-http.mjs'], {
    env: {
      ...process.env,
      PAYOUT_PREVIEW_URL: url,
      PAYOUT_TEST_PROJECT_ID: 'orange-salad-93665842',
      PAYOUT_TEST_ISOLATION_CONFIRMED: 'yes',
      PAYOUT_EXTERNAL_EFFECTS_DISABLED: 'yes',
      PAYOUT_PREVIEW_READ_ONLY: 'yes',
      VERCEL_ENV: 'preview',
      ...overrides,
    },
    encoding: 'utf8', timeout: 2500,
  });
}
for (const [label, url] of [
  ['embedded credentials', 'https://user:password@mypickup-payout-test-synthetic.vercel.app/'],
  ['nonstandard port', 'https://mypickup-payout-test-synthetic.vercel.app:8443/'],
  ['production domain', 'https://mypickup.kr/'],
  ['query string', `${safe}?secret=1`],
  ['fragment', `${safe}#secret`],
  ['non-HTTPS scheme', 'http://mypickup-payout-test-synthetic.vercel.app/'],
]) {
  test(`preview smoke rejects ${label} before network access`, () => {
    const result = check(url);
    assert.notEqual(result.status, 0, `${label} must be blocked`);
    assert.equal(result.signal, null, `${label} must fail before network timeout`);
    assert.match(result.stderr, /AssertionError/);
  });
}
for (const [label, overrides] of [
  ['missing isolation confirmation', { PAYOUT_TEST_ISOLATION_CONFIRMED: '' }],
  ['wrong synthetic project', { PAYOUT_TEST_PROJECT_ID: 'production-project' }],
  ['external effects not disabled', { PAYOUT_EXTERNAL_EFFECTS_DISABLED: 'no' }],
  ['read-only consent missing', { PAYOUT_PREVIEW_READ_ONLY: '' }],
  ['production runtime', { VERCEL_ENV: 'production' }],
]) {
  test(`preview smoke rejects ${label} before network access`, () => {
    const result = check(safe, overrides);
    assert.notEqual(result.status, 0, `${label} must be blocked`);
    assert.equal(result.signal, null, `${label} must fail before network timeout`);
    assert.match(result.stderr, /AssertionError/);
  });
}
