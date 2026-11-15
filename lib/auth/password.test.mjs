import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Exercise the production password functions, not a reimplementation.
const source = readFileSync(new URL("./password.ts", import.meta.url), "utf8");
const javascript = source.replaceAll("password: string", "password").replaceAll("stored: string", "stored");
assert.notEqual(javascript, source, "Expected TypeScript parameter annotations");
const { hashPassword, verifyPassword } = await import(`data:text/javascript,${encodeURIComponent(javascript)}`);

test("synthetic account password hashes verify correctly", () => {
  const password = "synthetic-test-password-2026!";
  const hash = hashPassword(password);
  assert.match(hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("incorrect-password", hash), false);
});
test("password hashes use a unique salt", () => {
  const password = "synthetic-test-password-2026!";
  const first = hashPassword(password);
  const second = hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(verifyPassword(password, first), true);
  assert.equal(verifyPassword(password, second), true);
});
test("disabled and malformed hashes never authenticate", () => {
  for (const hash of ["disabled$synthetic", "", "scrypt$", "plaintext", "sha256$123$456"]) {
    assert.equal(verifyPassword("synthetic-test-password-2026!", hash), false);
  }
});
