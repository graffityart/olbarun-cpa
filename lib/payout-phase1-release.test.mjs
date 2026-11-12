import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const absent = [
  "app/api/partner/payout-verification/route.ts",
  "app/api/admin/payout-verifications/[partnerId]/review/route.ts",
  "app/api/admin/payout-verifications/[partnerId]/documents/[kind]/route.ts",
  "app/admin/payout-verifications/page.tsx",
  "db/migrations/0020_partner_payout_verifications.sql",
  "db/migrations/0021_partner_payout_upload_limits.sql",
];

test("phase-one release excludes KYC document endpoints, UI and migrations", () => {
  for (const file of absent) assert.equal(existsSync(file), false, file);
});

test("phase-one settlement APIs do not query KYC tables or enable enforcement", () => {
  for (const file of ["app/api/partner/settlements/route.ts", "app/api/admin/settlements/[id]/review/route.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /partner_payout_verifications|PAYOUT_KYC_ENFORCEMENT|PAYOUT_KYC_DOCUMENT_UPLOAD/, file);
  }
});

test("phase-one settlement page does not load private-document UI", () => {
  const source = readFileSync("app/partner/settlements/page.tsx", "utf8");
  assert.doesNotMatch(source, /PayoutVerificationForm|PayoutVerificationReview|PayoutVerificationReset/);
});

test("partner payout UI preserves ambiguous-response duplicate submission lock", () => {
  const source = readFileSync("components/SettlementRequest.tsx", "utf8");
  assert.match(source, /if \(inFlight\.current \|\| completed \|\| outcomeUnknown/);
  assert.match(source, /if \(res\.ok \|\| res\.status >= 500/);
  assert.match(source, /setOutcomeUnknown\(true\)/);
  assert.match(source, /res\.status !== 201/);
});

test("admin payout UI rechecks server status and requires transfer confirmation", () => {
  const source = readFileSync("components/SettlementReview.tsx", "utf8");
  assert.match(source, /\/api\/admin\/settlements\/\$\{id\}\/status/);
  assert.match(source, /current\.auditVerified!==true\|\|current\.amountVerified!==true/);
  assert.match(source, /action==="PAID"&&!transferConfirmed/);
  assert.match(source, /reviewSubmitted\?["']?요청 결과가 불확실합니다/);
});

test("partner settlement API preserves transactional lock, exact amount and audit", () => {
  const source = readFileSync("app/api/partner/settlements/route.ts", "utf8");
  assert.match(source, /requirePayoutSameOrigin\(request\)/);
  assert.match(source, /getDb\(\)\.transaction\(async tx=>/);
  assert.match(source, /for update/);
  assert.match(source, /BigInt\(amount\)!==total/);
  assert.match(source, /status:"HOLD"/);
  assert.match(source, /action:"SETTLEMENT_REQUEST"/);
  assert.match(source, /status:201/);
});

test("admin settlement API preserves row lock, transfer confirmation and atomic state transitions", () => {
  const source = readFileSync("app/api/admin/settlements/[id]/review/route.ts", "utf8");
  assert.match(source, /requirePayoutSameOrigin\(request\)/);
  assert.match(source, /requireAdmin\(\)/);
  assert.match(source, /action==="PAID"&&body\.transferConfirmed!==true/);
  assert.match(source, /getDb\(\)\.transaction\(async tx=>/);
  assert.match(source, /for update/);
  assert.match(source, /settlementAuditMatches\(/);
  assert.match(source, /hasUniqueSettlementEarnings\(/);
  assert.match(source, /settlementAmountsMatch\(/);
  assert.match(source, /status:"PAID"/);
  assert.match(source, /status:"AVAILABLE"/);
  assert.match(source, /action:`SETTLEMENT_\$\{action\}`/);
});

test("partner payout form explains account privacy without requiring KYC documents", () => {
  const source = readFileSync("components/SettlementRequest.tsx", "utf8");
  assert.match(source, /본인 명의 계좌를 사용하고/);
  assert.match(source, /계좌번호를 채팅이나 게시글에 공개하지 마세요/);
  assert.doesNotMatch(source, /bankDocument|identityDocument|privacyMaskConfirmed/);
});

test("phase-one release has no KYC routes, document components or migration files", () => {
  const walk = (root) => {
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
      const path = `${root}/${entry.name}`;
      return entry.isDirectory() ? walk(path) : [path];
    });
  };
  const shipped = [...walk("app"), ...walk("components"), ...walk("db/migrations")];
  const forbidden = /(?:payout-verifications?|PayoutVerification|002[01]_partner_payout_)/i;
  const matches = shipped.filter((path) => forbidden.test(path));
  assert.deepEqual(matches, [], `KYC-only assets accidentally included: ${matches.join(", ")}`);
});

test("partner settlement history is limited to current partner and disables caching", () => {
  const source = readFileSync("app/api/partner/settlements/route.ts", "utf8");
  assert.match(source, /eq\(settlements\.partnerId,user\.partnerId\)/);
  assert.match(source, /\.limit\(10\)/);
  assert.match(source, /"Cache-Control":"no-store"/);
});

test("phase-one release workflow uses only disposable PostgreSQL for integration tests", () => {
  const source = readFileSync(".github/workflows/payout-phase1-release.yml", "utf8");
  assert.match(source, /image: postgres:16/);
  assert.match(source, /SETTLEMENT_TEST_DB_CONFIRM: disposable/);
  assert.ok(source.includes("SETTLEMENT_TEST_DATABASE_URL: postgresql://settlement_test:settlement_test_password@localhost:5432/settlement_ci"));
  for (const secret of ["DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "PII_ENCRYPTION_KEY"]) {
    assert.equal(source.includes(`secrets.${secret}`), false, `production secret reference: ${secret}`);
  }
  assert.doesNotMatch(source, /(?:vercel deploy --prod|db:migrate|drizzle-kit migrate)/);
});

test("phase-one workflow covers payout UI and status API changes", () => {
  const source = readFileSync(".github/workflows/payout-phase1-release.yml", "utf8");
  for (const file of [
    "components/SettlementRequest.tsx",
    "components/SettlementReview.tsx",
    "app/api/admin/settlements/[id]/status/route.ts",
    "lib/settlement-concurrency.test.mjs",
    "lib/settlement-validation.test.mjs",
    "lib/settlement-validation.ts",
    "docs/payout-phase1-release-scope.md",
  ]) assert.ok(source.includes(file), `missing workflow path: ${file}`);
});

test("partner settlement history never caches success or error responses", () => {
  const source = readFileSync("app/api/partner/settlements/route.ts", "utf8");
  const history = source.slice(source.indexOf("export async function GET()"));
  assert.match(history, /error:"UNAUTHORIZED"[^;]*"Cache-Control":"no-store"/);
  assert.match(history, /error:"LOOKUP_FAILED"[^;]*"Cache-Control":"no-store"/);
  assert.match(history, /settlements:rows[^;]*"Cache-Control":"no-store"/);
});

test("admin settlement status never caches authenticated or error responses", () => {
  const source = readFileSync("app/api/admin/settlements/[id]/status/route.ts", "utf8");
  assert.match(source, /const privateResponseHeaders = \{ "Cache-Control": "no-store" \}/);
  for (const status of [400, 401, 403, 404, 500]) {
    assert.ok(source.includes(`status: ${status}, headers: privateResponseHeaders`), `missing no-store on ${status}`);
  }
  assert.match(source, /auditVerified, amountVerified \}, \{ headers: privateResponseHeaders \}/);
});

test("admin settlement review responses cannot be cached", () => {
  const source = readFileSync("app/api/admin/settlements/[id]/review/route.ts", "utf8");
  assert.match(source, /const privateResponseHeaders=\{"Cache-Control":"no-store"\}/);
  assert.match(source, /Response\.json\(\{ok:true\},\{headers:privateResponseHeaders\}\)/);
  assert.match(source, /Response\.json\(\{ok:false,error\},\{status,headers:privateResponseHeaders\}\)/);
  assert.match(source, /error:"TRANSFER_CONFIRMATION_REQUIRED"\},\{status:400,headers:privateResponseHeaders\}/);
});

test("partner settlement POST prevents caching success and error responses", () => {
  const source = readFileSync("app/api/partner/settlements/route.ts", "utf8");
  const submit = source.slice(0, source.indexOf("export async function GET()"));
  assert.match(submit, /const privateResponseHeaders=\{"Cache-Control":"no-store"\}/);
  for (const status of [201, 400, 401]) {
    assert.ok(submit.includes(`status:${status},headers:privateResponseHeaders`), `missing no-store on ${status}`);
  }
  assert.match(submit, /return Response\.json\(\{ok:false,error\},\{status,headers:privateResponseHeaders\}\)/);
});
