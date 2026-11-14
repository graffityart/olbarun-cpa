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

const headers = { accept: "application/json" };
if (process.env.PAYOUT_PREVIEW_BYPASS_TOKEN) {
  headers["x-vercel-protection-bypass"] = process.env.PAYOUT_PREVIEW_BYPASS_TOKEN;
}
function assertApplicationResponse(response, path) {
  const contentType = response.headers.get("content-type") ?? "";
  const redirectLocation = response.headers.get("location") ?? "";
  const isProtectionPage = response.status === 302 || response.status === 307 ||
    /text\\/html/i.test(contentType) || /_vercel_sso|vercel\\.com\\/login/i.test(redirectLocation);
  assert.ok(!isProtectionPage,
    `${path}: Vercel Deployment Protection intercepted the request. Use authorized Preview access; do not disable SSO.`);
  assert.equal(response.status, 401,
    `${path}: expected application 401; got ${response.status}`);
  assert.match(contentType, /application\\/json/,
    `${path}: expected application JSON`);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/,
    `${path}: private response must not be cached`);
}

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
console.log("Unauthenticated payout Preview HTTP smoke checks passed; no login, settlement, or database writes performed.");
