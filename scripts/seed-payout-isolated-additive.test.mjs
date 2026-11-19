import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const script = resolve("scripts/seed-payout-isolated-additive.mjs");
const base = {
  ...process.env,
  NODE_ENV: "test",
  VERCEL_ENV: "preview",
  DATABASE_URL: "",
  PAYOUT_TEST_PROJECT_ID: "orange-salad-93665842",
  PAYOUT_TEST_BRANCH_ID: "br-falling-sunset-be4st6wz",
  PAYOUT_TEST_ISOLATION_CONFIRMED: "yes",
  PAYOUT_EXTERNAL_EFFECTS_DISABLED: "yes",
  PAYOUT_ADDITIVE_SEED_CONFIRM: "isolated-additive-only",
  PAYOUT_TEST_DATABASE_URL: "postgresql://fake:fake@integration-test.neon.tech/mypickup_payout_test?sslmode=require",
  PAYOUT_TEST_EXPECTED_HOST: "integration-test.neon.tech",
  PAYOUT_ADDITIVE_TEST_PASSWORD: "synthetic-integration-only-strong",
};
function mustReject(overrides, pattern) {
  const p = spawnSync(process.execPath, [script], {
    encoding: "utf8", timeout: 5000, env: { ...base, ...overrides },
  });
  assert.notEqual(p.status, 0);
  assert.match(p.stderr, pattern);
}
test("additive seed rejects original branch", () => mustReject({ PAYOUT_TEST_BRANCH_ID: "br-royal-cherry-bemnl5l2" }, /br-falling-sunset-be4st6wz/));
test("additive seed rejects production runtime", () => mustReject({ NODE_ENV: "production" }, /production/));
test("additive seed rejects production Vercel", () => mustReject({ VERCEL_ENV: "production" }, /production/));
test("additive seed requires isolated confirmation", () => mustReject({ PAYOUT_ADDITIVE_SEED_CONFIRM: "no" }, /isolated-additive-only/));
test("additive seed rejects external effects", () => mustReject({ PAYOUT_EXTERNAL_EFFECTS_DISABLED: "no" }, /yes/));
test("additive seed rejects mismatched DB host", () => mustReject({ PAYOUT_TEST_EXPECTED_HOST: "other.neon.tech" }, /different Neon branch host/));
test("additive seed rejects application DB URL", () => mustReject({ DATABASE_URL: "postgresql://fake:fake@prod.neon.tech/production?sslmode=require" }, /Do not seed/));
test("additive seed rejects weak passwords", () => mustReject({ PAYOUT_ADDITIVE_TEST_PASSWORD: "short" }, /strong additive/));
test("additive seed rejects non-test database", () => mustReject({ PAYOUT_TEST_DATABASE_URL: "postgresql://fake:fake@integration-test.neon.tech/production?sslmode=require" }, /mypickup_payout_test/));
test("additive seed never modifies existing sessions or passwords", () => {
  const source = readFileSync(script, "utf8");
  assert.doesNotMatch(source, /delete\s+from\s+auth_sessions|update\s+users\s+set|on\s+conflict\s*\(/i);
  assert.match(source, /already_seeded/);
  assert.match(source, /assert\.equal\(state\.already_seeded, 0/);
  assert.match(source, /sql\.begin\(async tx =>/);
});
