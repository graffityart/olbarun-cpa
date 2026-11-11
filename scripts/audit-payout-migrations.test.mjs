import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/audit-payout-migrations.mjs");
function run(sql, strict = false) {
  const dir = mkdtempSync(join(tmpdir(), "payout-migration-audit-"));
  try {
    mkdirSync(join(dir, "db/migrations"), { recursive: true });
    writeFileSync(join(dir, "db/migrations/0000_test.sql"), sql);
    const p = spawnSync(process.execPath, [script], {
      cwd: dir, encoding: "utf8",
      env: { ...process.env, PAYOUT_MIGRATION_STRICT: strict ? "yes" : "no" },
    });
    return { status: p.status, output: JSON.parse(p.stdout) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test("safe CREATE TABLE is reported without risk", () => {
  const r = run("CREATE TABLE IF NOT EXISTS example (id uuid PRIMARY KEY);", true);
  assert.equal(r.status, 0);
  assert.equal(r.output.report[0].requiresManualReview, false);
});
test("destructive SQL is flagged in report mode", () => {
  const r = run("DROP TABLE users;", false);
  assert.equal(r.status, 0);
  assert.equal(r.output.report[0].requiresManualReview, true);
  assert.equal(r.output.report[0].flaggedOperations[0].line, 1);
});
test("strict mode fails when UPDATE is present", () => {
  const r = run("SELECT 1;\nUPDATE users SET status = 'ACTIVE';", true);
  assert.equal(r.status, 2);
  assert.equal(r.output.report[0].flaggedOperations[0].line, 2);
});
