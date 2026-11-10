import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const safe = {
  PAYOUT_STAGING_DATABASE_URL: "postgresql://synthetic:fake@isolated-staging.example.invalid/synthetic_test",
  PAYOUT_STAGING_BASE_URL: "https://payout-staging.example.invalid",
  PAYOUT_STAGING_TEST_PARTNER_ID: "synthetic-partner",
  PAYOUT_STAGING_TEST_ADMIN_ID: "synthetic-admin",
  PAYOUT_STAGING_SYNTHETIC_DATA_CONFIRMED: "yes",
  PAYOUT_STAGING_NOTIFICATIONS_DISABLED: "yes",
  PAYOUT_STAGING_ISOLATED_DB_CONFIRMED: "yes",
  NODE_ENV: "test",
  VERCEL_ENV: "preview",
};
function check(overrides = {}) {
  const env = { PATH: process.env.PATH ?? "", ...safe, ...overrides };
  return spawnSync(process.execPath, ["scripts/check-payout-phase1-staging.mjs"], { env, encoding: "utf8" });
}
test("staging preflight accepts only explicit synthetic isolation attestations", () => {
  const result = check();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No network calls or payouts/);
});
test("staging preflight blocks production URL and database reuse", () => {
  assert.notEqual(check({ PAYOUT_STAGING_BASE_URL: "https://mypickup.kr" }).status, 0);
  assert.notEqual(check({ DATABASE_URL: safe.PAYOUT_STAGING_DATABASE_URL }).status, 0);
  assert.notEqual(check({ DATABASE_URL: "postgresql://production:secret@isolated-staging.example.invalid/production" }).status, 0);
  assert.notEqual(check({ DATABASE_URL: "not-a-valid-url" }).status, 0);
});
test("staging preflight blocks missing isolation, notifications and KYC enforcement", () => {
  for (const overrides of [
    { PAYOUT_STAGING_ISOLATED_DB_CONFIRMED: "no" },
    { PAYOUT_STAGING_SYNTHETIC_DATA_CONFIRMED: "" },
    { PAYOUT_STAGING_NOTIFICATIONS_DISABLED: "" },
    { PAYOUT_KYC_ENFORCEMENT: "enabled" },
    { PAYOUT_KYC_DOCUMENT_UPLOAD: "enabled" },
    { NODE_ENV: "production" },
  ]) assert.notEqual(check(overrides).status, 0, JSON.stringify(overrides));
});
