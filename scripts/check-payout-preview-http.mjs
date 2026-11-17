import assert from "node:assert/strict";

const base = process.env.PAYOUT_PREVIEW_URL;
assert.ok(base, "PAYOUT_PREVIEW_URL is required");
const url = new URL(base);
assert.equal(url.protocol, "https:", "HTTPS Preview required");
assert.ok(url.hostname.startsWith("mypickup-payout-test-"), "Only dedicated payout Preview deployments are permitted");
assert.ok(url.hostname.endsWith(".vercel.app"), "Only Vercel Preview host is permitted");
assert.equal(url.pathname, "/", "Use deployment root URL only");
assert.equal(url.search, "", "Preview URL must not contain a query");
assert.equal(url.hash, "", "Preview URL must not contain a fragment");
assert.equal(process.env.PAYOUT_TEST_PROJECT_ID, "orange-salad-93665842");
assert.equal(process.env.PAYOUT_TEST_ISOLATION_CONFIRMED, "yes");
assert.notEqual(process.env.VERCEL_ENV, "production");
assert.equal(process.env.PAYOUT_EXTERNAL_EFFECTS_DISABLED, "yes",
  "Payout Preview smoke must explicitly disable external effects");
assert.equal(process.env.PAYOUT_PREVIEW_READ_ONLY, "yes",
  "Explicit read-only smoke consent is required");


const headers = { accept: "application/json" };
if (process.env.PAYOUT_PREVIEW_BYPASS_TOKEN) {
  headers["x-vercel-protection-bypass"] = process.env.PAYOUT_PREVIEW_BYPASS_TOKEN;
}
function assertApplicationResponse(response, path) {
  const contentType = response.headers.get("content-type") ?? "";
  const redirectLocation = response.headers.get("location") ?? "";
  const isProtectionPage = response.status === 302 || response.status === 307 ||
    /text\/html/i.test(contentType) || /_vercel_sso|vercel\.com\/login/i.test(redirectLocation);
  assert.ok(!isProtectionPage,
    `${path}: Vercel Deployment Protection intercepted the request. Use authorized Preview access; do not disable SSO.`);
  assert.equal(response.status, 401,
    `${path}: expected application 401; got ${response.status}`);
  assert.match(contentType, /application\/json/,
    `${path}: expected application JSON`);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/,
    `${path}: private response must not be cached`);
}

const healthResponse = await fetch(new URL("/api/health/db", url), {
  headers, redirect: "manual", signal: AbortSignal.timeout(15000),
});
assert.equal(healthResponse.status, 200, "Dedicated Preview database health must return HTTP 200");
assert.match(healthResponse.headers.get("content-type") ?? "", /application\/json/);
assert.match(healthResponse.headers.get("cache-control") ?? "", /(?:^|,\s*)no-store(?:\s*,|$)/i,
  "Dedicated Preview health responses must never be cached");
assert.match(healthResponse.headers.get("x-robots-tag") ?? "", /noindex/i,
  "Dedicated Preview must remain excluded from search indexing");
const health = await healthResponse.json();
assert.equal(health.ok, true, "Dedicated Preview health must report success");
assert.equal(health.database, "connected", "Dedicated Preview must use a connected database");
console.log("PASS /api/health/db: dedicated Preview database connected and noindex");

const cases = [
  ["/api/partner/settlements", "UNAUTHORIZED"],
  ["/api/admin/settlements/00000000-0000-4000-8000-000000000000/status", "UNAUTHORIZED"],
];
for (const [path, expected] of cases) {
  const response = await fetch(new URL(path, url), {
    headers, redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  assertApplicationResponse(response, path);
  const body = await response.json();
  assert.deepEqual(body, { ok: false, error: expected }, `${path}: unexpected application response`);
  console.log(`PASS ${path}: unauthenticated, private JSON`);
}
const mutationCases = [
  "/api/partner/settlements",
  "/api/admin/settlements/00000000-0000-4000-8000-000000000000/review",
];
for (const path of mutationCases) {
  const response = await fetch(new URL(path, url), {
    method: "POST",
    headers: { ...headers, origin: url.origin, "content-type": "application/json" },
    body: JSON.stringify({ action: "APPROVE", amount: 1 }),
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  assertApplicationResponse(response, path);
  assert.deepEqual(await response.json(), { ok: false, error: "UNAUTHORIZED" });
  console.log(`PASS ${path}: unauthenticated POST blocked before database mutation`);
}
// Missing Origin must be rejected for cookie-authenticated payout mutations.
for (const path of mutationCases) {
  const response = await fetch(new URL(path, url), {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ action: "APPROVE", amount: 1 }),
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const location = response.headers.get("location") ?? "";
  assert.ok(response.status !== 302 && response.status !== 307 && !/text\/html/i.test(contentType) && !/_vercel_sso|vercel\.com\/login/i.test(location),
    `${path}: Vercel Deployment Protection intercepted missing-Origin POST`);
  assert.equal(response.status, 403, `${path}: missing-Origin POST must be forbidden`);
  assert.match(contentType, /application\/json/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(await response.json(), { ok: false, error: "INVALID_ORIGIN" });
  console.log(`PASS ${path}: missing-Origin POST rejected`);
}
// Reject cross-site payout mutations before authentication or any database write.
for (const path of mutationCases) {
  const response = await fetch(new URL(path, url), {
    method: "POST",
    headers: { ...headers, origin: "https://cross-origin.invalid", "content-type": "application/json" },
    body: JSON.stringify({ action: "APPROVE", amount: 1 }),
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const location = response.headers.get("location") ?? "";
  assert.ok(response.status !== 302 && response.status !== 307 && !/text\/html/i.test(contentType) && !/_vercel_sso|vercel\.com\/login/i.test(location),
    `${path}: Vercel Deployment Protection intercepted cross-origin POST; application CSRF validation was not tested`);
  assert.equal(response.status, 403, `${path}: cross-origin POST must be forbidden`);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(await response.json(), { ok: false, error: "INVALID_ORIGIN" });
  console.log(`PASS ${path}: cross-origin POST rejected`);
}
// Also reject opaque browser origins and deceptive same-site lookalikes.
for (const [label, origin] of [
  ["opaque sandbox origin", "null"],
  ["lookalike subdomain", `${url.origin}.attacker.invalid`],
  ["unexpected port", `${url.origin}:8443`],
]) {
  for (const path of mutationCases) {
    const response = await fetch(new URL(path, url), {
      method: "POST",
      headers: { ...headers, origin, "content-type": "application/json" },
      body: JSON.stringify({ action: "APPROVE", amount: 1 }),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const location = response.headers.get("location") ?? "";
    assert.ok(response.status !== 302 && response.status !== 307 &&
      !/text\/html/i.test(contentType) &&
      !/_vercel_sso|vercel\.com\/login/i.test(location),
      `${path}: Deployment Protection intercepted ${label} POST`);
    assert.equal(response.status, 403, `${path}: ${label} POST must be forbidden`);
    assert.match(contentType, /application\/json/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.deepEqual(await response.json(), { ok: false, error: "INVALID_ORIGIN" });
    console.log(`PASS ${path}: ${label} rejected`);
  }
}
// Login CSRF checks use intentionally invalid empty credentials: no session or DB writes.
for (const [label, origin, expectedStatus, expectedError] of [
  ["missing Origin", null, 403, "INVALID_ORIGIN"],
  ["foreign Origin", "https://cross-origin.invalid", 403, "INVALID_ORIGIN"],
  ["matching Origin with invalid input", url.origin, 400, "INVALID_INPUT"],
]) {
  const loginHeaders = { ...headers, "content-type": "application/json" };
  if (origin !== null) loginHeaders.origin = origin;
  const response = await fetch(new URL("/api/auth/login", url), {
    method: "POST", headers: loginHeaders, body: "{}", redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const location = response.headers.get("location") ?? "";
  assert.ok(![302, 307].includes(response.status) && !/text\/html/i.test(contentType) &&
    !/_vercel_sso|vercel\.com\/login/i.test(location),
    `/api/auth/login: Deployment Protection intercepted ${label}`);
  assert.equal(response.status, expectedStatus, `login ${label}: unexpected status`);
  assert.match(contentType, /application\/json/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(await response.json(), { ok: false, error: expectedError });
  assert.equal(response.headers.get("set-cookie"), null, "Invalid login must not create a session");
  console.log(`PASS /api/auth/login: ${label} rejected without session cookie`);
}
console.log("Unauthenticated payout Preview HTTP smoke checks passed; no login, settlement, or database writes performed.");
