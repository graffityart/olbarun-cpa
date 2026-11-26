import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const seed = readFileSync(new URL('./seed-payout-auth-http-local.mjs', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../db/schema/finance.ts', import.meta.url), 'utf8');
const migrations = [...seed.matchAll(/'((?:\d{4}|\d{8})_[a-z0-9_]+\.sql)'/g)].map(match => match[1]);
const migrationText = migrations.map(name => readFileSync(new URL(`../db/migrations/${name}`, import.meta.url), 'utf8')).join('\n');
test('local authenticated payout fixture includes the posting finance migration in sequence', () => {
  const initial = migrations.indexOf('0000_initial.sql');
  const posting = migrations.indexOf('0003_posting_finance.sql');
  const uniqueness = migrations.indexOf('0011_settlement_item_uniqueness.sql');
  assert.equal(initial, 0);
  assert.ok(posting > initial);
  assert.ok(uniqueness > posting);
  assert.equal(new Set(migrations).size, migrations.length);
});
test('fixture migrations provide every earnings column queried by the payout application', () => {
  const earningDefinition = finance.match(/export const earnings=pgTable\("earnings",\{([\s\S]*?)\}\s*,\s*\(table\)/)?.[1];
  assert.ok(earningDefinition, 'Cannot locate earnings schema; update parity test when schema changes');
  const columns = [...earningDefinition.matchAll(/\w+:\s*(?:uuid|varchar|integer|text|timestamp)\("([a-z_]+)"/g)].map(match => match[1]);
  assert.ok(columns.includes('posting_submission_id'));
  for (const column of columns) {
    assert.match(migrationText, new RegExp(`\\b${column}\\b`, 'i'), `Missing fixture migration for earnings.${column}`);
  }
});
