import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
function fixture(mutator) {
  const dir = mkdtempSync(join(tmpdir(), 'mypickup-release-preflight-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    mkdirSync(join(dir, 'db/migrations'), { recursive: true });
    const files = ['package.json', 'scripts/check-payout-release-readiness.mjs', 'scripts/seed-payout-auth-http-local.mjs', 'scripts/test-payout-auth-http-local.mjs', 'scripts/payout-auth-http-local-guards.test.mjs', 'scripts/payout-auth-fixture-schema.test.mjs'];
    for (const file of files) cpSync(new URL(file, root), join(dir, file));
    mutator?.(dir);
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    const run = spawnSync(process.execPath, ['scripts/check-payout-release-readiness.mjs'], { cwd: dir, encoding: 'utf8', timeout: 5000 });
    return { code: run.status, output: `${run.stdout}\n${run.stderr}` };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('preflight passes with required local safety contracts', () => {
  const result = fixture();
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /production environment.*NOT verified/);
});
test('preflight fails closed when required migration is absent', () => {
  const result = fixture(dir => {
    const path = join(dir, 'scripts/seed-payout-auth-http-local.mjs');
    const original = requireText(path);
    writeFileSync(path, original.replace('0003_posting_finance.sql', '0003_removed.sql'));
  });
  assert.notEqual(result.code, 0);
});
test('preflight fails closed when authentication test lacks production guard', () => {
  const result = fixture(dir => {
    const path = join(dir, 'scripts/test-payout-auth-http-local.mjs');
    writeFileSync(path, requireText(path).replaceAll('NODE_ENV', 'REMOVED_ENV_GUARD'));
  });
  assert.notEqual(result.code, 0);
});
test('preflight fails when payout rejection audit coverage is removed', () => {
  const result = fixture(dir => {
    const path = join(dir, 'scripts/test-payout-auth-http-local.mjs');
    writeFileSync(path, requireText(path).replaceAll('SETTLEMENT_REJECT', 'REMOVED_REJECTION_AUDIT'));
  });
  assert.notEqual(result.code, 0);
});
test('preflight fails when concurrent request coverage is removed', () => {
  const result = fixture(dir => {
    const path = join(dir, 'scripts/test-payout-auth-http-local.mjs');
    writeFileSync(path, requireText(path).replace('Promise.all', 'Promise.resolve'));
  });
  assert.notEqual(result.code, 0);
});
test('preflight fails when payout HTTP rollback coverage is removed', () => {
  const result = fixture(dir => {
    const path = join(dir, 'scripts/test-payout-auth-http-local.mjs');
    writeFileSync(path, requireText(path).replaceAll('local_fail_settlement_item_insert', 'REMOVED_ROLLBACK_INJECTION'));
  });
  assert.notEqual(result.code, 0);
});
test('preflight fails when payout HTTP rollback audit assertion is removed', () => {
  const result = fixture(dir => {
    const path = join(dir, 'scripts/test-payout-auth-http-local.mjs');
    writeFileSync(path, requireText(path).replace('Failed request must roll back settlement audit', 'REMOVED_ROLLBACK_AUDIT'));
  });
  assert.notEqual(result.code, 0);
});
function requireText(path) { return readFileSync(path, 'utf8'); }
