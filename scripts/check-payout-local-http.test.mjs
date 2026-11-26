import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = 'scripts/check-payout-local-http.mjs';
function preflight(url) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, PAYOUT_LOCAL_HTTP_URL: url },
    encoding: 'utf8', timeout: 4000,
  });
}

test('local payout smoke rejects remote and ambiguous destinations before network access', () => {
  for (const url of [
    'https://127.0.0.1:3219/',
    'http://localhost:3219/',
    'http://127.0.0.1/',
    'http://127.0.0.1:3219/secret',
    'http://127.0.0.1:3219/?x=1',
    'http://127.0.0.1:3219/#fragment',
    'http://user:pass@127.0.0.1:3219/',
    'http://mypickup.kr:3219/',
    'http://127.0.0.1:443/',
  ]) {
    const result = preflight(url);
    assert.notEqual(result.status, 0, `unsafe target accepted: ${url}`);
    assert.equal(result.signal, null, `preflight timed out: ${url}`);
  }
});
