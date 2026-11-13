import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(path, "utf8");
const migrations = [
  "0000_initial.sql",
  "0001_advertiser_users.sql",
  "0002_notifications.sql",
  "0005_audit_logs.sql",
  "0006_login_attempts.sql",
  "0011_settlement_item_uniqueness.sql",
];
const sql = migrations.map(f => read("db/migrations/" + f)).join("\n");
const apiPaths = [
  "app/api/partner/settlements/route.ts",
  "app/api/admin/settlements/[id]/review/route.ts",
  "app/api/admin/settlements/[id]/status/route.ts",
];
test("all payout API database tables exist in minimum migration set", () => {
  const sources = apiPaths.map(read).join("\n");
  const tables = ["partners", "earnings", "settlements", "settlementItems", "auditLogs"];
  const mapping = { settlementItems: "settlement_items", auditLogs: "audit_logs" };
  for (const table of tables) {
    assert.match(sources, new RegExp("\\b" + table + "\\b"));
    assert.match(sql, new RegExp("CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+" + (mapping[table] || table) + "\\b", "i"));
  }
});
test("payout notification calls require notifications migration", () => {
  const request = read(apiPaths[0]);
  const review = read(apiPaths[1]);
  const notificationLibrary = read("lib/notifications.ts");
  assert.match(request, /notifyAdmins\s*\(/);
  assert.match(review, /notifyUser\s*\(/);
  assert.match(notificationLibrary, /insert\(notifications\)/);
  assert.ok(migrations.includes("0002_notifications.sql"));
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+notifications\b/i);
});
test("admin payout review requires settlement audit log and state transition columns", () => {
  const review = read(apiPaths[1]);
  assert.match(review, /SETTLEMENT_\$\{action\}/);
  for (const column of ["approved_at", "paid_at", "deduction_amount", "payment_amount"]) {
    assert.match(sql, new RegExp("\\b" + column + "\\b"));
  }
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+audit_logs\b/i);
});
test("never include partner activation data migration in minimum payout schema", () => {
  assert.ok(!migrations.includes("0009_partner_instant_signup.sql"));
});

test("partner payout creation requires active partner session and same-origin protection", () => {
  const request = read(apiPaths[0]);
  assert.match(request, /requirePayoutSameOrigin\(request\)/);
  assert.match(request, /getCurrentUser\(\)/);
  assert.match(request, /user\.role\s*!==\s*"PARTNER"/);
  assert.match(request, /user\.status\s*!==\s*"ACTIVE"/);
  assert.match(request, /!user\.partnerId/);
  assert.match(request, /for update/i);
  assert.match(request, /SETTLEMENT_ALREADY_PENDING/);
});
test("admin payout review requires admin role, origin guard, and explicit transfer confirmation", () => {
  const review = read(apiPaths[1]);
  const guards = read("lib/auth/guards.ts");
  assert.match(review, /requirePayoutSameOrigin\(request\)/);
  assert.match(review, /getCurrentUser\(\)/);
  assert.match(review, /transferConfirmed\s*!==\s*true/);
  assert.match(review, /for update/i);
  assert.match(guards, /user\.status\s*!==\s*"ACTIVE"/);
  assert.match(guards, /user\.role\s*!==\s*"ADMIN"\s*&&\s*user\.role\s*!==\s*"SUPER_ADMIN"/);
});
test("admin payout status endpoint rejects non-admin sessions", () => {
  const status = read(apiPaths[2]);
  assert.match(status, /getCurrentUser\(\)/);
  assert.match(status, /\["ADMIN",\s*"SUPER_ADMIN"\]\.includes\(user\.role\)/);
  assert.match(status, /user\.status\s*!==\s*"ACTIVE"/);
});

test("read-only Neon readiness preflight covers every minimum payout table and unique index", () => {
  const preflight = read("scripts/check-payout-test-schema.mjs");
  const required = ["users", "partners", "advertisers", "advertiser_users", "notifications", "earnings", "settlements", "settlement_items", "auth_sessions", "audit_logs", "login_attempts"];
  for (const table of required) assert.ok(preflight.includes('"' + table + '"'), "Missing readiness check for " + table);
  assert.match(preflight, /settlement_items_settlement_earning_unique/);
  assert.match(preflight, /default_transaction_read_only/);
  assert.match(preflight, /PAYOUT_TEST_PROJECT_ID/);
  assert.match(preflight, /missing\.length\s*\|\|\s*!uniqueIndexReady/);
});

test("partner payout listing and reservation remain scoped to the authenticated partner", () => {
  const request = read(apiPaths[0]);
  assert.match(request, /eq\(settlements\.partnerId,\s*user\.partnerId/);
  assert.match(request, /eq\(earnings\.partnerId,\s*user\.partnerId/);
  assert.match(request, /select id from \$\{partners\} where id=\$\{user\.partnerId!\} for update/i);
  assert.match(request, /eq\(earnings\.status,\s*"AVAILABLE"\)/);
  assert.match(request, /eq\(settlements\.partnerId,\s*user\.partnerId\)\)/);
  assert.match(request, /"Cache-Control"\s*:\s*"no-store"/);
});
test("payout requests never accept a client-provided partner identifier", () => {
  const request = read(apiPaths[0]);
  assert.doesNotMatch(request, /body\.partnerId|body\.userId|body\.settlementId/);
  assert.match(request, /partnerId\s*:\s*user\.partnerId/);
});

test("Neon readiness check verifies the actual unique index definition", () => {
  const preflight = read("scripts/check-payout-test-schema.mjs");
  assert.match(preflight, /indexdef/);
  assert.match(preflight, /CREATE\\s\+UNIQUE\\s\+INDEX/);
  assert.match(preflight, /settlement_id/);
  assert.match(preflight, /earning_id/);
  assert.doesNotMatch(preflight, /CREATE\\\\s\+UNIQUE/);
});

test("synthetic fixture preflight is read-only and rejects production targets", () => {
  const preflight = read("scripts/check-payout-synthetic-fixtures.mjs");
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.scripts["db:check-payout-fixtures"], "node scripts/check-payout-synthetic-fixtures.mjs");
  for (const required of ["default_transaction_read_only", "PAYOUT_TEST_PROJECT_ID", "PAYOUT_TEST_ISOLATION_CONFIRMED", "NODE_ENV", "VERCEL_ENV", "mypickup_payout_test", "login_disabled"]) {
    assert.ok(preflight.includes(required), "Missing fixture safety guard: " + required);
  }
  assert.doesNotMatch(preflight, /db`\s*(?:insert|update|delete|drop|truncate|alter|create)\b/i);
});

test("synthetic fixture verifier fails closed before DB connection for unsafe environments", async () => {
  const { spawnSync } = await import("node:child_process");
  const base = {
    PAYOUT_TEST_PROJECT_ID: "orange-salad-93665842",
    PAYOUT_TEST_ISOLATION_CONFIRMED: "yes",
    PAYOUT_TEST_DATABASE_URL: "postgresql://test:fake@synthetic.neon.tech/mypickup_payout_test?sslmode=require",
    NODE_ENV: "test",
    VERCEL_ENV: "preview",
    DATABASE_URL: "",
  };
  const cases = [
    [{ PAYOUT_TEST_PROJECT_ID: "soft-mud-72335385" }, /orange-salad-93665842/],
    [{ PAYOUT_TEST_ISOLATION_CONFIRMED: "no" }, /yes/],
    [{ NODE_ENV: "production" }, /production/],
    [{ VERCEL_ENV: "production" }, /production/],
    [{ PAYOUT_TEST_DATABASE_URL: "postgresql://test:fake@synthetic.neon.tech/production?sslmode=require" }, /mypickup_payout_test/],
    [{ PAYOUT_TEST_DATABASE_URL: "postgresql://test:fake@localhost/mypickup_payout_test?sslmode=require" }, /neon.tech/],
    [{ DATABASE_URL: "postgresql://prod:fake@synthetic.neon.tech/production?sslmode=require" }, /ERR_ASSERTION|AssertionError/],
  ];
  for (const [overrides, expected] of cases) {
    const result = spawnSync(process.execPath, ["scripts/check-payout-synthetic-fixtures.mjs"], {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, ...base, ...overrides },
    });
    assert.notEqual(result.status, 0, "Unsafe configuration must fail");
    assert.match(result.stderr, expected);
  }
});


test("isolated payout deployment fails closed for production DB runtime", () => {
  const db = read("db/index.ts");
  for (const guard of [
    "PAYOUT_TEST_PROJECT_ID",
    "PAYOUT_TEST_ISOLATION_CONFIRMED",
    "PAYOUT_EXTERNAL_EFFECTS_DISABLED",
    'process.env.VERCEL_ENV === "production"',
    'target.pathname !== "/mypickup_payout_test"',
    'target.searchParams.get("sslmode") !== "require"',
    "PAYOUT_TEST_RUNTIME_ISOLATION_FAILED",
  ]) assert.ok(db.includes(guard), "Missing runtime guard: " + guard);
  assert.ok(db.indexOf("PAYOUT_TEST_RUNTIME_ISOLATION_FAILED") < db.indexOf("postgres(connectionString"), "Runtime guard must precede connection");
});

test("synthetic payout deployment blocks live postbacks and external Blob operations", () => {
  for (const [path, marker] of [
    ["app/api/postback/cpa/route.ts", "POSTBACK_DISABLED_IN_PAYOUT_TEST"],
    ["app/api/campaign-blob-upload/[campaignId]/route.ts", "UPLOAD_DISABLED_IN_PAYOUT_TEST"],
    ["app/api/campaign-blob-upload/[campaignId]/finalize/route.ts", "UPLOAD_FINALIZE_DISABLED_IN_PAYOUT_TEST"],
  ]) {
    const source = read(path);
    assert.ok(source.includes('process.env.PAYOUT_TEST_PROJECT_ID === "orange-salad-93665842"'), "Missing isolation gate: " + path);
    assert.ok(source.includes(marker), "Missing disabled response: " + path);
    assert.ok(source.includes("status:503"), "Missing fail-closed status: " + path);
  }
});


test("direct PostgreSQL API routes must use validated connection URLs", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const walk = directory => readdirSync(directory).flatMap(name => {
    const path = directory + "/" + name;
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
  for (const path of [...walk("app/api"), ...walk("lib")]) {
    const source = read(path);
    if (!/from\s+["']postgres["']/.test(source)) continue;
    assert.ok(source.includes("getValidatedDatabaseUrl"), "Direct postgres import must use validated DB URL: " + path);
    assert.doesNotMatch(source, /postgres\(\s*process\.env\.DATABASE_URL\b/, "Unvalidated direct DB connection: " + path);
  }
});

test("isolated payout runtime prevents external Blob reads and deletes", () => {
  const source = read("app/api/posting-materials/[campaignId]/[fileId]/route.ts");
  const readGate = source.indexOf('if(process.env.PAYOUT_TEST_PROJECT_ID==="orange-salad-93665842")return new Response(null,{status:503});');
  const blobGet = source.indexOf("await get(file.blob_url");
  const deleteGate = source.indexOf('if(process.env.PAYOUT_TEST_PROJECT_ID==="orange-salad-93665842")return Response.json({error:"BLOB_DELETE_DISABLED_IN_PAYOUT_TEST"},{status:503});');
  const blobDelete = source.indexOf("await del(blobs[0].blob_url)");
  assert.ok(readGate >= 0 && blobGet > readGate, "Blob read must fail closed in payout test runtime");
  assert.ok(deleteGate >= 0 && blobDelete > deleteGate, "Blob deletion must fail closed in payout test runtime");
});


test("payout API enforces role, origin and transfer confirmation before writes", () => {
  const request = read("app/api/partner/settlements/route.ts");
  const review = read("app/api/admin/settlements/[id]/review/route.ts");
  assert.ok(request.includes("requirePayoutSameOrigin(request)"), "Partner payout request must validate origin");
  assert.ok(request.includes('user.role!=="PARTNER"'), "Payout request must be partner-only");
  assert.ok(request.includes("for update"), "Payout request must lock earnings before reserving them");
  assert.ok(request.includes('status:"HOLD"'), "Payout request must reserve earnings");
  assert.ok(review.includes("requirePayoutSameOrigin(request)"), "Admin review must validate origin");
  assert.ok(review.includes('admin.role!=="ADMIN"&&admin.role!=="SUPER_ADMIN"'), "Admin review must enforce admin role");
  assert.ok(review.includes('action==="PAID"&&body.transferConfirmed!==true'), "Paid transition requires explicit transfer confirmation");
  assert.ok(review.indexOf('action==="PAID"&&body.transferConfirmed!==true') < review.indexOf("getDb().transaction"), "Transfer confirmation must precede DB mutation");
  assert.ok(review.includes("for update"), "Admin review must lock settlement");
  assert.ok(review.includes('eq(settlements.status,"APPROVED")'), "Paid transition must only update approved settlements");
});


test("payout notifications stay in the isolated database without external delivery", () => {
  const notifications = read("lib/notifications.ts");
  assert.match(notifications, /getDb\(\)\.insert\(notifications\)/);
  assert.doesNotMatch(notifications, /\bfetch\s*\(|\baxios\b|\bnodemailer\b|\bresend\b|\btwilio\b|\bsendgrid\b|\bhttps?\.request\s*\(/i);
  const partner = read("app/api/partner/settlements/route.ts");
  const admin = read("app/api/admin/settlements/[id]/review/route.ts");
  assert.match(partner, /notifyAdmins\(/);
  assert.match(admin, /notifyUser\(/);
});

test("payout mutations reject missing Origin instead of silently allowing it", () => {
  const origin = read("lib/security/origin.ts");
  assert.match(origin, /export function requirePayoutSameOrigin/);
  assert.match(origin, /if \(!request\.headers\.get\("origin"\)\) throw new Error\("INVALID_ORIGIN"\)/);
  assert.match(origin, /requireSameOrigin\(request\)/);
  for (const path of ["app/api/partner/settlements/route.ts", "app/api/admin/settlements/[id]/review/route.ts"]) {
    assert.match(read(path), /requirePayoutSameOrigin\(request\)/);
  }
});

test("payout Origin guard rejects missing and mismatched origins at runtime", async () => {
  const source = read("lib/security/origin.ts").replaceAll("request: Request", "request");
  const { requirePayoutSameOrigin } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  const request = (origin, host = "preview.example.test", proto = "https") => ({
    headers: new Headers({
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": proto,
      ...(origin === null ? {} : { origin }),
    }),
  });
  assert.throws(() => requirePayoutSameOrigin(request(null)), /INVALID_ORIGIN/);
  assert.throws(() => requirePayoutSameOrigin(request("")), /INVALID_ORIGIN/);
  assert.throws(() => requirePayoutSameOrigin(request("https://attacker.example.test")), /INVALID_ORIGIN/);
  assert.throws(() => requirePayoutSameOrigin(request("http://preview.example.test")), /INVALID_ORIGIN/);
  assert.throws(() => requirePayoutSameOrigin(request("https://preview.example.test:444")), /INVALID_ORIGIN/);
  assert.doesNotThrow(() => requirePayoutSameOrigin(request("https://preview.example.test")));
});


test("payout history and admin status endpoints enforce session roles and private responses", () => {
  const partner = read("app/api/partner/settlements/route.ts");
  const admin = read("app/api/admin/settlements/[id]/status/route.ts");
  assert.match(partner, /export async function GET\(\)/);
  assert.match(partner, /user\.role\s*!==\s*"PARTNER"/);
  assert.match(partner, /user\.status\s*!==\s*"ACTIVE"/);
  assert.match(partner, /eq\(settlements\.partnerId,user\.partnerId\)/);
  assert.match(partner, /"Cache-Control":\s*"no-store"/);
  assert.match(admin, /export async function GET\(/);
  assert.match(admin, /if \(!user\).*"UNAUTHORIZED"/);
  assert.match(admin, /user\.status !== "ACTIVE"/);
  assert.match(admin, /\["ADMIN", "SUPER_ADMIN"\]\.includes\(user\.role\)/);
  assert.match(admin, /"Cache-Control": "no-store"/);
  assert.match(admin, /settlementAuditMatches\(/);
  assert.match(admin, /settlementAmountsMatch\(/);
});


test("admin payout review responds with explicit 401 and 403 before database mutation", () => {
  const review = read("app/api/admin/settlements/[id]/review/route.ts");
  assert.match(review, /const admin=await getCurrentUser\(\)/);
  assert.match(review, /if\(!admin\)return Response\.json\(\{ok:false,error:"UNAUTHORIZED"\},\{status:401,headers:privateResponseHeaders\}\)/);
  assert.match(review, /admin\.status!=="ACTIVE"/);
  assert.match(review, /admin\.role!=="ADMIN"&&admin\.role!=="SUPER_ADMIN"/);
  assert.match(review, /error:"FORBIDDEN"\},\{status:403,headers:privateResponseHeaders\}/);
  assert.match(review, /"Cache-Control":"no-store"/);
  assert.doesNotMatch(review, /requireAdmin\(\)/);
  const auth = review.indexOf("const admin=await getCurrentUser()");
  const forbidden = review.indexOf('error:"FORBIDDEN"');
  const mutation = review.indexOf("getDb().transaction");
  assert.ok(auth >= 0 && forbidden > auth && mutation > forbidden, "Authorization must precede payout mutation");
});


test("partner payout POST distinguishes missing session from forbidden partner access", () => {
  const source = read("app/api/partner/settlements/route.ts");
  const post = source.slice(source.indexOf("export async function POST("), source.indexOf("export async function GET("));
  assert.match(post, /if\(!user\)return Response\.json\(\{ok:false,error:"UNAUTHORIZED"\},\{status:401,headers:privateResponseHeaders\}\)/);
  assert.match(post, /user\.role!=="PARTNER"\|\|user\.status!=="ACTIVE"\|\|!user\.partnerId/);
  assert.match(post, /error:"FORBIDDEN"\},\{status:403,headers:privateResponseHeaders\}/);
  const auth = post.indexOf("const user=await getCurrentUser()");
  const forbidden = post.indexOf('error:"FORBIDDEN"');
  const mutation = post.indexOf("getDb().transaction");
  assert.ok(auth >= 0 && forbidden > auth && mutation > forbidden, "Partner role validation must precede payout mutation");
});


test("partner payout history GET distinguishes unauthenticated from forbidden roles", () => {
  const source = read("app/api/partner/settlements/route.ts");
  const get = source.slice(source.indexOf("export async function GET("));
  assert.match(get, /if\(!user\)return Response\.json\(\{ok:false,error:"UNAUTHORIZED"\},\{status:401,headers:privateResponseHeaders\}\)/);
  assert.match(get, /user\.role!=="PARTNER"\|\|user\.status!=="ACTIVE"\|\|!user\.partnerId/);
  assert.match(get, /error:"FORBIDDEN"\},\{status:403,headers:privateResponseHeaders\}/);
  assert.match(get, /eq\(settlements\.partnerId,user\.partnerId\)/);
  assert.ok(get.indexOf('error:"FORBIDDEN"') < get.indexOf("getDb().select"), "Role check must precede payout history query");
});


test("payout history and status responses never expose bank account snapshots or session secrets", () => {
  const partner = read("app/api/partner/settlements/route.ts");
  const history = partner.slice(partner.indexOf("export async function GET("));
  const admin = read("app/api/admin/settlements/[id]/status/route.ts");
  for (const [label, source] of [["partner history", history], ["admin status", admin]]) {
    assert.doesNotMatch(source, /bankAccountSnapshot|accountNumber|tokenHash|passwordHash|select\(\)/, `${label} must select only non-sensitive fields`);
    assert.match(source, /"Cache-Control"(?::"no-store"|: "no-store")|headers:privateResponseHeaders/, `${label} must not be cached`);
  }
  assert.match(history, /settlementCode:settlements\.settlementCode/);
  assert.match(admin, /status: settlements\.status/);
});


test("isolated Preview HTTP smoke remains read-only and validates application responses", () => {
  const source = read("scripts/check-payout-preview-http.mjs");
  assert.match(source, /PAYOUT_TEST_ISOLATION_CONFIRMED/);
  assert.match(source, /mypickup-payout-test-/);
  assert.match(source, /response\.status, 401/);
  assert.match(source, /cache-control/);
  assert.match(source, /redirect: "manual"/);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
  assert.doesNotMatch(source, /fetch\([^\n]*mypickup\.kr/);
});
