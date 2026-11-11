import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(path, "utf8");
const migrations = [
  "0000_initial.sql",
  "0001_advertiser_users.sql",
  "0002_notifications.sql",
  "0005_audit_logs.sql",
  "0006_login_attempts.sql",
  "0011_settlement_item_uniqueness.sql",
];
const sql = migrations.map(f => read("db/migrations/" + f)).join("\n");
const apiPaths = [
  "app/api/partner/settlements/route.ts",
  "app/api/admin/settlements/[id]/review/route.ts",
  "app/api/admin/settlements/[id]/status/route.ts",
];
test("all payout API database tables exist in minimum migration set", () => {
  const sources = apiPaths.map(read).join("\n");
  const tables = ["partners", "earnings", "settlements", "settlementItems", "auditLogs"];
  const mapping = { settlementItems: "settlement_items", auditLogs: "audit_logs" };
  for (const table of tables) {
    assert.match(sources, new RegExp("\\b" + table + "\\b"));
    assert.match(sql, new RegExp("CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+" + (mapping[table] || table) + "\\b", "i"));
  }
});
test("payout notification calls require notifications migration", () => {
  const request = read(apiPaths[0]);
  const review = read(apiPaths[1]);
  const notificationLibrary = read("lib/notifications.ts");
  assert.match(request, /notifyAdmins\s*\(/);
  assert.match(review, /notifyUser\s*\(/);
  assert.match(notificationLibrary, /insert\(notifications\)/);
  assert.ok(migrations.includes("0002_notifications.sql"));
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+notifications\b/i);
});
test("admin payout review requires settlement audit log and state transition columns", () => {
  const review = read(apiPaths[1]);
  assert.match(review, /SETTLEMENT_\$\{action\}/);
  for (const column of ["approved_at", "paid_at", "deduction_amount", "payment_amount"]) {
    assert.match(sql, new RegExp("\\b" + column + "\\b"));
  }
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+audit_logs\b/i);
});
test("never include partner activation data migration in minimum payout schema", () => {
  assert.ok(!migrations.includes("0009_partner_instant_signup.sql"));
});

test("partner payout creation requires active partner session and same-origin protection", () => {
  const request = read(apiPaths[0]);
  assert.match(request, /requireSameOrigin\(request\)/);
  assert.match(request, /getCurrentUser\(\)/);
  assert.match(request, /user\.role\s*!==\s*"PARTNER"/);
  assert.match(request, /user\.status\s*!==\s*"ACTIVE"/);
  assert.match(request, /!user\.partnerId/);
  assert.match(request, /for update/i);
  assert.match(request, /SETTLEMENT_ALREADY_PENDING/);
});
test("admin payout review requires admin role, origin guard, and explicit transfer confirmation", () => {
  const review = read(apiPaths[1]);
  const guards = read("lib/auth/guards.ts");
  assert.match(review, /requireSameOrigin\(request\)/);
  assert.match(review, /requireAdmin\(\)/);
  assert.match(review, /transferConfirmed\s*!==\s*true/);
  assert.match(review, /for update/i);
  assert.match(guards, /user\.status\s*!==\s*"ACTIVE"/);
  assert.match(guards, /user\.role\s*!==\s*"ADMIN"\s*&&\s*user\.role\s*!==\s*"SUPER_ADMIN"/);
});
test("admin payout status endpoint rejects non-admin sessions", () => {
  const status = read(apiPaths[2]);
  assert.match(status, /getCurrentUser\(\)/);
  assert.match(status, /\["ADMIN",\s*"SUPER_ADMIN"\]\.includes\(user\.role\)/);
  assert.match(status, /user\.status\s*!==\s*"ACTIVE"/);
});

test("read-only Neon readiness preflight covers every minimum payout table and unique index", () => {
  const preflight = read("scripts/check-payout-test-schema.mjs");
  const required = ["users", "partners", "advertisers", "advertiser_users", "notifications", "earnings", "settlements", "settlement_items", "auth_sessions", "audit_logs", "login_attempts"];
  for (const table of required) assert.ok(preflight.includes('"' + table + '"'), "Missing readiness check for " + table);
  assert.match(preflight, /settlement_items_settlement_earning_unique/);
  assert.match(preflight, /default_transaction_read_only/);
  assert.match(preflight, /PAYOUT_TEST_PROJECT_ID/);
  assert.match(preflight, /missing\.length\s*\|\|\s*!uniqueIndexReady/);
});

test("partner payout listing and reservation remain scoped to the authenticated partner", () => {
  const request = read(apiPaths[0]);
  assert.match(request, /eq\(settlements\.partnerId,\s*user\.partnerId/);
  assert.match(request, /eq\(earnings\.partnerId,\s*user\.partnerId/);
  assert.match(request, /select id from \$\{partners\} where id=\$\{user\.partnerId!\} for update/i);
  assert.match(request, /eq\(earnings\.status,\s*"AVAILABLE"\)/);
  assert.match(request, /eq\(settlements\.partnerId,\s*user\.partnerId\)\)/);
  assert.match(request, /"Cache-Control"\s*:\s*"no-store"/);
});
test("payout requests never accept a client-provided partner identifier", () => {
  const request = read(apiPaths[0]);
  assert.doesNotMatch(request, /body\.partnerId|body\.userId|body\.settlementId/);
  assert.match(request, /partnerId\s*:\s*user\.partnerId/);
});
