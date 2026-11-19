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

// Regression: malformed cookies are rejected before the session DB lookup.
test("session lookup rejects malformed tokens before querying the database", () => {
  const session = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
  const guard = 'if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;';
  assert.ok(session.includes(guard), "Session token format guard must remain present");
  assert.ok(session.indexOf(guard) < session.indexOf("const now = new Date();", session.indexOf("export async function getCurrentUser")), "Reject invalid tokens before session lookup");
  const pattern = /^[0-9a-f]{64}$/;
  for (const token of ["abc", "z".repeat(64), "f".repeat(256), ""]) assert.equal(pattern.test(token), false);
  assert.equal(pattern.test("f".repeat(64)), true);
});

test("logout avoids session DB deletion for malformed cookies", () => {
  const session = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
  assert.match(session, /if \(token && \/\^\[0-9a-f\]\{64\}\$\/\.test\(token\)\) await getDb\(\)\.delete\(authSessions\)/);
  assert.match(session, /store\.set\(COOKIE_NAME, "",/,
    "Logout must still clear the browser cookie even when the token is malformed");
});

test("logout errors and success responses are not cacheable", () => {
  const logout = readFileSync(new URL("../../app/api/auth/logout/route.ts", import.meta.url), "utf8");
  assert.match(logout, /status:303,headers:\{Location:[^\n]*'Cache-Control':'no-store'/);
  assert.match(logout, /Response\.json\(\{ok:true\},\{headers:\{'Cache-Control':'no-store'\}\}\)/);
  assert.match(logout, /status:forbidden\?403:500,headers:\{"Cache-Control":"no-store"\}/);
});

test("logout hides unexpected internal errors from clients", () => {
  const logout = readFileSync(new URL("../../app/api/auth/logout/route.ts", import.meta.url), "utf8");
  assert.match(logout, /error:forbidden\?message:"LOGOUT_FAILED"/);
  assert.match(logout, /if\(!forbidden\)console\.error\("Logout failed",e\)/);
});
