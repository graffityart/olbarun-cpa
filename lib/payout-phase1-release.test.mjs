import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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
  assert.match(source, /requireSameOrigin\(request\)/);
  assert.match(source, /getDb\(\)\.transaction\(async tx=>/);
  assert.match(source, /for update/);
  assert.match(source, /BigInt\(amount\)!==total/);
  assert.match(source, /status:"HOLD"/);
  assert.match(source, /action:"SETTLEMENT_REQUEST"/);
  assert.match(source, /status:201/);
});

test("admin settlement API preserves row lock, transfer confirmation and atomic state transitions", () => {
  const source = readFileSync("app/api/admin/settlements/[id]/review/route.ts", "utf8");
  assert.match(source, /requireSameOrigin\(request\)/);
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
