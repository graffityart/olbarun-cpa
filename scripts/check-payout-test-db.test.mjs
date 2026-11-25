import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const host of ['ep-unrelated.neon.tech', 'ep-summer-tree-beon5nsf.c-9.us-east-2.aws.neon.tech', 'ep-dry-frog-berkq3yn-pooler.c-9.us-east-2.aws.neon.tech.evil.invalid']) {
  test(`DB identity check rejects unapproved host ${host}`, () => {
    const result = spawnSync(process.execPath, ['scripts/check-payout-test-db.mjs'], {
      env: { ...process.env, PAYOUT_TEST_DATABASE_URL: `postgresql://fake:fake@${host}/mypickup_payout_test?sslmode=require` },
      encoding: 'utf8', timeout: 2500,
    });
    assert.equal(result.status, 1);
    assert.equal(result.signal, null);
    assert.match(result.stderr, /Verified isolated Neon endpoint required/);
  });
}
