import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Execute the real origin implementation after removing only its TypeScript Request annotations.
const source = readFileSync(new URL("./origin.ts", import.meta.url), "utf8");
const javascript = source.replaceAll("request: Request", "request");
assert.notEqual(javascript, source, "Expected origin.ts Request annotations");
const { requirePayoutSameOrigin } = await import(
  `data:text/javascript,${encodeURIComponent(javascript)}`
);

function request(origin, host = "preview.example.test", proto = "https") {
  const headers = new Headers({ host, "x-forwarded-proto": proto });
  if (origin !== null) headers.set("origin", origin);
  return { headers };
}

test("payout POST requires Origin", () => {
  assert.throws(() => requirePayoutSameOrigin(request(null)), /INVALID_ORIGIN/);
});
test("payout POST accepts exact matching HTTPS Origin", () => {
  assert.doesNotThrow(() => requirePayoutSameOrigin(request("https://preview.example.test")));
});
test("payout POST rejects foreign Origin", () => {
  assert.throws(() => requirePayoutSameOrigin(request("https://cross-origin.invalid")), /INVALID_ORIGIN/);
});
test("payout POST rejects HTTP Origin for HTTPS host", () => {
  assert.throws(() => requirePayoutSameOrigin(request("http://preview.example.test")), /INVALID_ORIGIN/);
});
test("payout POST honors forwarded host", () => {
  const headers = new Headers({
    host: "internal.example.test",
    "x-forwarded-host": "preview.example.test",
    "x-forwarded-proto": "https",
    origin: "https://preview.example.test",
  });
  assert.doesNotThrow(() => requirePayoutSameOrigin({ headers }));
});
test("payout POST rejects missing host", () => {
  const headers = new Headers({ origin: "https://preview.example.test" });
  assert.throws(() => requirePayoutSameOrigin({ headers }), /ORIGIN_CHECK_FAILED/);
});

test("payout POST rejects opaque Origin from sandboxed contexts", () => {
  assert.throws(() => requirePayoutSameOrigin(request("null")), /INVALID_ORIGIN/);
});
test("payout POST rejects lookalike subdomain", () => {
  assert.throws(() => requirePayoutSameOrigin(request("https://preview.example.test.attacker.invalid")), /INVALID_ORIGIN/);
});
test("payout POST rejects explicit unexpected port", () => {
  assert.throws(() => requirePayoutSameOrigin(request("https://preview.example.test:8443")), /INVALID_ORIGIN/);
});
test("payout POST rejects mismatched forwarded host", () => {
  const headers = new Headers({
    host: "preview.example.test",
    "x-forwarded-host": "different.example.test",
    "x-forwarded-proto": "https",
    origin: "https://preview.example.test",
  });
  assert.throws(() => requirePayoutSameOrigin({ headers }), /INVALID_ORIGIN/);
});

// Regression guard: login must enforce the same explicit-Origin requirement as payout writes.
test("login POST requires an explicit Origin before reading credentials", () => {
  const login = readFileSync(new URL("../../app/api/auth/login/route.ts", import.meta.url), "utf8");
  const guard = 'if(!request.headers.get("origin"))throw new Error("INVALID_ORIGIN");';
  const sameOrigin = "requireSameOrigin(request);";
  const readCredentials = "await request.json()";
  assert.ok(login.includes(guard), "Login must reject a missing Origin");
  assert.ok(login.indexOf(guard) < login.indexOf(sameOrigin), "Origin presence check must precede same-origin validation");
  assert.ok(login.indexOf(sameOrigin) < login.indexOf(readCredentials), "Origin checks must precede credential parsing");
});

test("login responses explicitly disable caching for success and every error path", () => {
  const login = readFileSync(new URL("../../app/api/auth/login/route.ts", import.meta.url), "utf8");
  assert.match(login, /function privateJson\(/, "Private JSON helper must exist");
  assert.match(login, /headers\.set\("cache-control","no-store"\)/, "Login helper must set no-store");
  assert.match(login, /return Response\.json\(body,\{\.\.\.init,headers\}\)/, "Helper must return response with protected headers");
  const withoutHelper = login.replace(/function privateJson\([\s\S]*?\}\n/, "");
  assert.ok(!withoutHelper.includes("Response.json("), "Every login response must use privateJson");
  assert.ok((withoutHelper.match(/privateJson\(/g) ?? []).length >= 5, "Protect all login response paths");
});

test("payout routes enforce role and ACTIVE status before database operations", () => {
  const routes = [
    ["../../app/api/partner/settlements/route.ts", /user\.role\s*!==\s*"PARTNER"\s*\|\|\s*user\.status\s*!==\s*"ACTIVE"/, /getDb\(\)\.transaction/],
    ["../../app/api/admin/settlements/[id]/review/route.ts", /admin\.status\s*!==\s*"ACTIVE"\s*\|\|\s*\(admin\.role\s*!==\s*"ADMIN"\s*&&\s*admin\.role\s*!==\s*"SUPER_ADMIN"\)/, /getDb\(\)\.transaction/],
    ["../../app/api/admin/settlements/[id]/status/route.ts", /user\.status\s*!==\s*"ACTIVE"\s*\|\|\s*!\["ADMIN",\s*"SUPER_ADMIN"\]\.includes\(user\.role\)/, /getDb\(\)\.transaction/],
  ];
  for (const [path, guard, databaseOperation] of routes) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const roleCheck = source.search(guard);
    const databaseCall = source.search(databaseOperation);
    assert.ok(roleCheck >= 0, `${path}: expected role/status guard`);
    assert.ok(databaseCall > roleCheck, `${path}: role guard must precede payout database transaction`);
    assert.match(source, /error:\s*"FORBIDDEN"/, `${path}: denied roles must receive FORBIDDEN`);
  }
});

test("logout POST requires an explicit Origin before deleting sessions", () => {
  const logout = readFileSync(new URL("../../app/api/auth/logout/route.ts", import.meta.url), "utf8");
  const guard = 'if(!request.headers.get("origin"))throw new Error("INVALID_ORIGIN");';
  assert.ok(logout.includes(guard));
  assert.ok(logout.indexOf(guard) < logout.indexOf("requireSameOrigin(request)"));
  assert.ok(logout.indexOf("requireSameOrigin(request)") < logout.indexOf("await destroySession()"));
});

test("payout mutation routes require explicit Origin before authentication and writes", () => {
  const routes = [
    "../../app/api/partner/settlements/route.ts",
    "../../app/api/admin/settlements/[id]/review/route.ts",
  ];
  for (const path of routes) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const originCheck = source.indexOf("requirePayoutSameOrigin(request)");
    const authentication = source.indexOf("await getCurrentUser()");
    const transaction = source.indexOf("getDb().transaction");
    assert.ok(originCheck >= 0, `${path}: missing payout Origin validation`);
    assert.ok(authentication > originCheck, `${path}: authentication must follow Origin validation`);
    assert.ok(transaction > authentication, `${path}: writes must follow authentication`);
  }
});
