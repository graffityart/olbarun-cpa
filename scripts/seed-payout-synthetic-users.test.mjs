import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/seed-payout-synthetic-users.mjs");
const base = {
  PAYOUT_TEST_PROJECT_ID: "orange-salad-93665842",
  PAYOUT_TEST_ISOLATION_CONFIRMED: "yes",
  PAYOUT_SYNTHETIC_SEED_CONFIRM: "synthetic-only",
  PAYOUT_EXTERNAL_EFFECTS_DISABLED: "yes",
  PAYOUT_TEST_DATABASE_URL: "postgresql://test:fake@synthetic.neon.tech/mypickup_payout_test?sslmode=require",
  PAYOUT_SYNTHETIC_PASSWORD: "only-for-testing-12345",
  NODE_ENV: "test",
  VERCEL_ENV: "preview",
  DATABASE_URL: "",
};
function rejected(overrides, expected) {
  const p = spawnSync(process.execPath, [script], {
    encoding: "utf8", timeout: 5000,
    env: { ...process.env, ...base, ...overrides },
  });
  assert.notEqual(p.status, 0, "Unsafe configuration must fail before connecting");
  assert.match(p.stderr, expected);
}
test("rejects wrong Neon project", () => rejected({ PAYOUT_TEST_PROJECT_ID: "production" }, /orange-salad-93665842/));
test("requires explicit synthetic-only confirmation", () => rejected({ PAYOUT_SYNTHETIC_SEED_CONFIRM: "no" }, /synthetic-only/));
test("requires disabled external side effects", () => rejected({ PAYOUT_EXTERNAL_EFFECTS_DISABLED: "no" }, /External email/));
test("rejects production runtime", () => rejected({ NODE_ENV: "production" }, /production/));
test("rejects production Vercel environment", () => rejected({ VERCEL_ENV: "production" }, /production/));
test("rejects non-test database name", () => rejected({ PAYOUT_TEST_DATABASE_URL: "postgresql://test:fake@synthetic.neon.tech/olbarun_cpa?sslmode=require" }, /mypickup_payout_test/));
test("rejects shared production database host", () => rejected({ DATABASE_URL: "postgresql://prod:fake@synthetic.neon.tech/production?sslmode=require" }, /Shared DB host forbidden/));
test("rejects weak password", () => rejected({ PAYOUT_SYNTHETIC_PASSWORD: "short" }, /Strong synthetic password required/));
test("rejects missing dedicated database credentials", () => rejected({ PAYOUT_TEST_DATABASE_URL: "postgresql://synthetic.neon.tech/mypickup_payout_test?sslmode=require" }, /Dedicated test DB credentials required/));
test("rejects unexpected database port", () => rejected({ PAYOUT_TEST_DATABASE_URL: "postgresql://test:fake@synthetic.neon.tech:6543/mypickup_payout_test?sslmode=require" }, /Unexpected test database port/));


test("credential seeding checks for existing settlements and sessions before updating users", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(script, "utf8");
  const settlementCheck = source.indexOf("(select count(*)::int from settlements)");
  const sessionCheck = source.indexOf("(select count(*)::int from auth_sessions)");
  const nonSyntheticCheck = source.indexOf("from users where email not like");
  const settlementGate = source.indexOf('assert.equal(state.settlement_count, 0');
  const sessionGate = source.indexOf('assert.equal(state.session_count, 0');
  const nonSyntheticGate = source.indexOf('assert.equal(state.non_synthetic_user_count, 0');
  const write = source.indexOf("await sql.begin(async tx =>");
  assert.ok(settlementCheck >= 0 && sessionCheck >= 0, "Both database counts must be checked");
  assert.ok(settlementGate > settlementCheck && sessionGate > sessionCheck, "Counts must be enforced");
  assert.ok(nonSyntheticCheck >= 0 && nonSyntheticGate > nonSyntheticCheck, "Non-synthetic users must be rejected");
  assert.ok(write > settlementGate && write > sessionGate && write > nonSyntheticGate, "All gates must precede credential writes");
});
