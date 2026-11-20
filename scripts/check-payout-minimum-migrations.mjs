import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const base = resolve("db/migrations");
const required = ["0000_initial.sql","0001_advertiser_users.sql",
  "0002_notifications.sql","0005_audit_logs.sql","0006_login_attempts.sql","0011_settlement_item_uniqueness.sql"];
const forbidden = ["0009_partner_instant_signup.sql"];
const source = Object.fromEntries(required.map(file => [file, readFileSync(resolve(base, file), "utf8")]));
const combined = Object.values(source).join("\n");
for (const table of ["users","partners","advertisers","advertiser_users","notifications","earnings","settlements","settlement_items","auth_sessions","audit_logs","login_attempts"]) {
  assert.match(combined, new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+["']?${table}\\b`, "i"), `Missing required table definition: ${table}`);
}
assert.match(source["0011_settlement_item_uniqueness.sql"], /CREATE\s+UNIQUE\s+INDEX/i);
for (const [file, sql] of Object.entries(source)) {
  assert.doesNotMatch(sql, /\b(?:DROP\s+(?:TABLE|SCHEMA)|TRUNCATE|DELETE\s+FROM|UPDATE\s+\w+(?:\s+\w+)?\s+SET|INSERT\s+INTO)\b/i, `Data changing SQL forbidden in minimum plan: ${file}`);
}
assert.ok(forbidden.every(file => !required.includes(file)));
console.log(JSON.stringify({ plan: "minimum-payout-schema", files: required, excludedDataMigration: forbidden, result: "static-check-passed", executedSql: false }, null, 2));
