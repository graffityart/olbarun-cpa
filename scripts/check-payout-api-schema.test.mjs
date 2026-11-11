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
